import { NextResponse } from 'next/server';
import supportItemRepository from '@/repositories/support-item.repository';

export async function GET() {
  try {
    const items = await supportItemRepository.listForDropdown();
    return NextResponse.json(items);
  } catch (error: any) {
    console.error('GET /api/support-items failed:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch support items' }, { status: 500 });
  }
}