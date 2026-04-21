/**
 * CompanyCam REST API service
 * Docs: https://api.companycam.com/v2
 */

const CC_BASE = 'https://api.companycam.com/v2';

function ccToken(): string {
  return import.meta.env.VITE_COMPANYCAM_TOKEN as string ?? '';
}

function ccHeaders() {
  return { Authorization: `Bearer ${ccToken()}`, 'Content-Type': 'application/json' };
}

// ─── Types ────────────────────────────────────────────────────────────────

export interface CCProject {
  id: string;
  name: string | null;
  street: string | null;   // address.street_address_1
  photoCount: number;
  featureThumb: string | null;
  publicUrl: string;
}

export interface CCPhoto {
  id: string;
  capturedAt: number;       // unix timestamp
  tags: string[];
  thumb: string;
  web: string;
  isVideo: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Normalise a string for fuzzy matching: lowercase, remove punctuation */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** True if the property address is "contained in" the project identifier */
export function addressMatchesProject(propertyAddress: string, project: CCProject): boolean {
  const addr = norm(propertyAddress);
  const name = norm(project.name ?? '');
  const street = norm(project.street ?? '');
  // Match if either project name or street contains the first part of the address (street number + street name)
  const addrCore = addr.split(',')[0].trim(); // e.g. "3526 evergreen ave"
  if (!addrCore || addrCore.length < 4) return false;
  return (
    name.includes(addrCore) ||
    (street.length > 4 && street.includes(addrCore)) ||
    (street.length > 4 && addrCore.includes(street)) ||
    (street.length > 4 && addr.includes(street))
  );
}

// ─── API calls ────────────────────────────────────────────────────────────

// Module-level cache — fetched once per browser session
let _projectsCache: CCProject[] | null = null;
let _projectsFetchPromise: Promise<CCProject[]> | null = null;

async function _doFetchProjects(): Promise<CCProject[]> {
  const token = ccToken();
  if (!token) throw new Error('CompanyCam token is missing — check VITE_COMPANYCAM_TOKEN in .env');

  const projects: CCProject[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const res = await fetch(`${CC_BASE}/projects?per_page=${perPage}&page=${page}&status=active`, {
      headers: ccHeaders(),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('[CC] projects fetch failed', res.status, text);
      break;
    }
    const data: any[] = await res.json();
    if (!data.length) break;

    for (const p of data) {
      projects.push({
        id: String(p.id),
        name: p.name ?? null,
        street: p.address?.street_address_1 ?? null,
        photoCount: p.photo_count ?? 0,
        featureThumb: p.feature_image?.find((i: any) => i.type === 'thumbnail')?.url ?? null,
        publicUrl: p.public_url ?? '',
      });
    }

    if (data.length < perPage) break;
    page++;
  }
  _projectsCache = projects;
  _projectsFetchPromise = null;
  return projects;
}

/** Fetch ALL projects (paginates automatically, cached after first load) */
export function fetchAllCCProjects(): Promise<CCProject[]> {
  if (_projectsCache) return Promise.resolve(_projectsCache);
  if (_projectsFetchPromise) return _projectsFetchPromise;
  _projectsFetchPromise = _doFetchProjects();
  return _projectsFetchPromise;
}

/** Get the CompanyCam feature thumbnail URL for a property address (uses cached projects) */
export async function getCCThumbForAddress(address: string): Promise<string | null> {
  try {
    const projects = await fetchAllCCProjects();
    const match = projects.find(p => addressMatchesProject(address, p));
    return match?.featureThumb ?? null;
  } catch {
    return null;
  }
}

/** Fetch photos for a project */
export async function fetchCCPhotos(projectId: string, perPage = 50): Promise<CCPhoto[]> {
  const res = await fetch(`${CC_BASE}/projects/${projectId}/photos?per_page=${perPage}&order_direction=desc`, {
    headers: ccHeaders(),
  });
  if (!res.ok) {
    console.error('[CC] photos fetch failed', res.status, projectId);
    return [];
  }
  const data: any[] = await res.json();

  return data.map(p => ({
    id: String(p.id),
    capturedAt: p.captured_at ?? 0,
    tags: (p.tags ?? []).map((t: any) => t.label ?? '').filter(Boolean),
    thumb: p.uris?.find((u: any) => u.type === 'thumbnail')?.uri ?? '',
    web:   p.uris?.find((u: any) => u.type === 'web')?.uri ?? p.uris?.[0]?.uri ?? '',
    isVideo: p.photo_type === 'video',
  }));
}
