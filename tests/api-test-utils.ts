import { NextRequest, NextResponse } from 'next/server';

// Ensure we are using the test environment
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://ndis:ndis_password@localhost:5432/ndis_invoicing_test';

export async function callRoute(handler: Function, options: {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  body?: any,
  params?: Record<string, string>,
  headers?: Record<string, string>,
}) {
  const url = new URL('http://localhost:3000');

  // Add params to URL if provided
  if (options.params) {
    Object.entries(options.params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  const request = new NextRequest(url, {
    method: options.method,
    headers: new Headers(options.headers),
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const response = await handler(request);
  const data = await response.json();

  return {
    status: response.status,
    data,
  };
}
