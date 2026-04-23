/**
 * GET /api/cron/investor-media
 *
 * Vercel Cron: runs daily at 07:15 UTC (10:15 Israel time).
 * For each investor with an email, checks each of their properties for
 * CompanyCam photos captured in the last 24 hours. If any are found,
 * emails the investor a summary ("N תמונות חדשות נוספו לנכס שלך").
 *
 * Also sends a separate admin notification per investor-with-new-photos
 * to millergroupartners@gmail.com.
 *
 * State-free: uses CompanyCam's photo.captured_at timestamp compared to
 * (now - 24h), so running daily = rolling 24h window.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { mondayQuery } from '../_lib/monday.js';
import { sendMail, wrapEmail } from '../_lib/email.js';

const PROPERTIES_BOARD_ID = 1997938102;
const INVESTORS_BOARD_ID  = 1997938105;
const INV_COL_EMAIL       = 'lead_email';
const INV_REL_ON_PROPERTY = 'board_relation_mkrzrtny';

const CC_API = 'https://api.companycam.com/v2';

function verifyAuth(req: VercelRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.authorization === `Bearer ${secret}`;
}

function getCCToken(): string {
  const t = (process.env.COMPANYCAM_TOKEN || process.env.VITE_COMPANYCAM_TOKEN || '').trim();
  if (!t) throw new Error('CompanyCam token missing');
  return t;
}

async function ccFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${CC_API}${path}`, {
    headers: { Authorization: `Bearer ${getCCToken()}` },
  });
  if (!res.ok) throw new Error(`CompanyCam HTTP ${res.status}`);
  return res.json();
}

interface CCProject { id: string; name: string; address?: { street_address_1?: string } }
interface CCPhoto   { id: string; photo_url?: string; uris?: { uri: string; type: string }[]; captured_at?: string }

function esc(s: string): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Loose address match — normalize case & punctuation, check substring each way */
function addressMatches(propAddr: string, project: CCProject): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();
  const a = norm(propAddr);
  const candidates = [project.name, project.address?.street_address_1].filter(Boolean).map(x => norm(x!));
  return candidates.some(c => c.includes(a) || a.includes(c));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!verifyAuth(req)) return res.status(401).json({ error: 'Unauthorized' });

  try {
    // 1. Fetch all investors with their email + linked properties
    const investorsQuery = `query {
      boards(ids: [${INVESTORS_BOARD_ID}]) {
        items_page(limit: 200) {
          items {
            id
            name
            column_values(ids: ["${INV_COL_EMAIL}"]) {
              id text value
            }
          }
        }
      }
    }`;
    type RawInv = { id: string; name: string; column_values: { id: string; text: string | null }[] };
    const invData = await mondayQuery<{ boards: { items_page: { items: RawInv[] } }[] }>(investorsQuery);
    const investors = invData?.boards?.[0]?.items_page?.items ?? [];

    // 2. Fetch all properties with their linked investor
    const propsQuery = `query {
      boards(ids: [${PROPERTIES_BOARD_ID}]) {
        items_page(limit: 500) {
          items {
            id
            name
            column_values(ids: ["${INV_REL_ON_PROPERTY}"]) {
              id
              ... on BoardRelationValue {
                linked_items { id name }
              }
            }
          }
        }
      }
    }`;
    type RawProp = { id: string; name: string; column_values: { id: string; linked_items?: { id: string; name: string }[] }[] };
    const propData = await mondayQuery<{ boards: { items_page: { items: RawProp[] } }[] }>(propsQuery);
    const properties = propData?.boards?.[0]?.items_page?.items ?? [];

    // Map investorId → list of property addresses
    const investorProperties = new Map<string, { address: string }[]>();
    for (const p of properties) {
      const linked = p.column_values[0]?.linked_items ?? [];
      for (const inv of linked) {
        const addr = p.name.split(',')[0].trim();
        if (!investorProperties.has(inv.id)) investorProperties.set(inv.id, []);
        investorProperties.get(inv.id)!.push({ address: addr });
      }
    }

    // 3. Fetch all CompanyCam projects once
    const ccProjects = await ccFetch<CCProject[]>('/projects?per_page=200');

    const now = Date.now();
    const cutoff = Math.floor((now - 24 * 60 * 60 * 1000) / 1000); // unix seconds

    const perInvestorSummary: Array<{ name: string; email: string; properties: Array<{ address: string; newCount: number; samplePhotoUrl?: string }> }> = [];

    // 4. Per investor, check each of their property's CC project for new photos
    for (const inv of investors) {
      const email = inv.column_values[0]?.text?.trim();
      if (!email) continue;

      const props = investorProperties.get(inv.id) || [];
      if (props.length === 0) continue;

      const propertiesWithNew: Array<{ address: string; newCount: number; samplePhotoUrl?: string }> = [];

      for (const prop of props) {
        const project = ccProjects.find(pr => addressMatches(prop.address, pr));
        if (!project) continue;
        try {
          const photos = await ccFetch<CCPhoto[]>(`/projects/${project.id}/photos?per_page=50`);
          const newOnes = photos.filter(ph => {
            if (!ph.captured_at) return false;
            const ts = Math.floor(new Date(ph.captured_at).getTime() / 1000);
            return ts >= cutoff;
          });
          if (newOnes.length > 0) {
            const sample = newOnes[0];
            const sampleUri = sample.photo_url
              || sample.uris?.find(u => u.type === 'original')?.uri
              || sample.uris?.[0]?.uri;
            propertiesWithNew.push({
              address: prop.address,
              newCount: newOnes.length,
              samplePhotoUrl: sampleUri,
            });
          }
        } catch (e) {
          console.error(`CC photos fetch failed for project ${project.id}:`, e);
        }
      }

      if (propertiesWithNew.length > 0) {
        perInvestorSummary.push({
          name: inv.name,
          email,
          properties: propertiesWithNew,
        });
      }
    }

    if (perInvestorSummary.length === 0) {
      return res.status(200).json({ ok: true, sent: false, reason: 'No new photos in last 24h' });
    }

    // 5. Email each investor + one summary to admin
    const GOLD = '#C9A84C';
    const portalUrl = process.env.PORTAL_URL || 'https://miller-group-portal.vercel.app';

    for (const summary of perInvestorSummary) {
      const totalPhotos = summary.properties.reduce((s, p) => s + p.newCount, 0);
      await sendMail({
        to: summary.email,
        subject: `${totalPhotos} תמונות חדשות התווספו לנכסי ההשקעה שלך`,
        html: wrapEmail({
          title: `תמונות חדשות בנכסים שלך`,
          bodyHtml: `
            <p>שלום ${esc(summary.name)},</p>
            <p>התווספו תמונות חדשות בנכסי ההשקעה שלך ב-24 השעות האחרונות:</p>
            <div style="margin:14px 0;">
              ${summary.properties.map(p => `
                <div style="background:rgba(201,168,76,0.06);border:1px solid rgba(201,168,76,0.25);padding:12px;border-radius:10px;margin-bottom:8px;display:flex;align-items:center;gap:12px;flex-direction:row-reverse;">
                  ${p.samplePhotoUrl ? `<img src="${esc(p.samplePhotoUrl)}" style="width:60px;height:60px;border-radius:8px;object-fit:cover;"/>` : ''}
                  <div style="flex:1;text-align:right;">
                    <div style="font-weight:700;color:#111;">${esc(p.address)}</div>
                    <div style="color:${GOLD};font-size:13px;margin-top:4px;">${p.newCount} תמונות חדשות</div>
                  </div>
                </div>`).join('')}
            </div>
          `,
          cta: { label: 'צפה בגלריה', url: portalUrl },
        }),
      }).catch(err => console.error('investor email failed for', summary.email, err));
    }

    // Admin summary
    const adminEmail = (process.env.GMAIL_USER || '').trim();
    const totalAcross = perInvestorSummary.reduce((s, i) => s + i.properties.reduce((s2, p) => s2 + p.newCount, 0), 0);
    await sendMail({
      to: adminEmail,
      subject: `${totalAcross} תמונות חדשות נוספו לנכסים (${perInvestorSummary.length} משקיעים)`,
      html: wrapEmail({
        title: 'סיכום תמונות חדשות',
        bodyHtml: `
          <p>סיכום אוטומטי של תמונות CompanyCam שנוספו ב-24 השעות האחרונות:</p>
          ${perInvestorSummary.map(inv => `
            <div style="background:#faf7f2;border:1px solid #e5dfd4;padding:12px;border-radius:10px;margin-bottom:8px;">
              <div style="font-weight:700;color:#111;">${esc(inv.name)}</div>
              <div style="color:#888;font-size:12px;">${esc(inv.email)}</div>
              <div style="margin-top:6px;font-size:13px;">
                ${inv.properties.map(p => `<div>📍 ${esc(p.address)} — <b style="color:${GOLD};">${p.newCount} תמונות</b></div>`).join('')}
              </div>
            </div>`).join('')}
        `,
        cta: { label: 'פתח את הפורטל', url: portalUrl },
      }),
    }).catch(err => console.error('admin media summary email failed:', err));

    return res.status(200).json({
      ok: true,
      sent: true,
      investorsNotified: perInvestorSummary.length,
      totalNewPhotos: totalAcross,
    });
  } catch (err: any) {
    console.error('investor-media cron error:', err);
    return res.status(500).json({ error: err?.message || 'Server error' });
  }
}
