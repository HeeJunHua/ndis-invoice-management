import { NextResponse } from 'next/server';
import categoryRepository from '@/repositories/category.repository';

export async function GET() {
  try {
    const categories = await categoryRepository.list();
    return NextResponse.json(categories);
  } catch (error: any) {
    console.error('GET /api/categories failed:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch categories' }, { status: 500 });
  }
}