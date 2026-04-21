import type { Property } from '../types';

export const PROPERTIES: Property[] = [
  {
    id: 'p1',
    address: '1423 Maple St, Indianapolis',
    city: 'Indianapolis, IN',
    status: 'בשיפוץ',
    statusType: 'gold',
    purchasePrice: '$127,000',
    arv: '$215,000',
    progress: 68,
    rentYield: '11.2%',
    renovCost: '$38,000',
    updates: [
      { date: 'אפריל 2026', text: 'הושלמה עבודות החשמל', done: true },
      { date: 'מרץ 2026', text: 'הוחלפו כל הצינורות', done: true },
      { date: 'פברואר 2026', text: 'עבודות גג בביצוע', done: false },
    ],
  },
  {
    id: 'p2',
    address: '8742 Elm Ave, Memphis',
    city: 'Memphis, TN',
    status: 'מושכר',
    statusType: 'green',
    purchasePrice: '$95,000',
    arv: '$162,000',
    progress: 100,
    rentYield: '9.8%',
    renovCost: '$24,500',
    updates: [
      { date: 'ינואר 2026', text: 'חוזה שכירות חודש ל-12 חודשים', done: true },
      { date: 'דצמבר 2025', text: 'שיפוץ מטבח הושלם', done: true },
      { date: 'נובמבר 2025', text: 'תיקוני גמר', done: true },
    ],
  },
  {
    id: 'p3',
    address: '3301 Oak Blvd, Cleveland',
    city: 'Cleveland, OH',
    status: 'בבדיקה',
    statusType: 'blue',
    purchasePrice: '$78,000',
    arv: '$138,000',
    progress: 15,
    rentYield: '10.5%',
    renovCost: '$31,000',
    updates: [
      { date: 'אפריל 2026', text: 'בדיקת נכס הושלמה', done: true },
      { date: 'מרץ 2026', text: 'בדיקה משפטית בביצוע', done: false },
    ],
  },
];
