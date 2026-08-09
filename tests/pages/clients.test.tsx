import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ClientsPage from '@/app/clients/page';
import * as apiClient from '@/lib/api-client';
import { message } from 'antd';

vi.mock('@/lib/api-client');
vi.mock('antd', async () => {
  const actual = await vi.importActual('antd');
  return {
    ...actual,
    message: {
      success: vi.fn(),
      error: vi.fn(),
    },
  };
});

describe('Clients Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch and display clients on mount', async () => {
    const mockClients = [
      { id: 1, first_name: 'John', last_name: 'Doe', email: 'john@example.com', ndis_number: 'NDIS123' },
    ];
    const mockGenders = [{ id: 1, label: 'Male' }];
    const mockRegions = [{ code: 'NSW', label: 'New South Wales' }];

    (apiClient.apiFetch as any).mockImplementation((url: string) => {
      if (url.includes('/api/clients')) return Promise.resolve({ data: mockClients });
      if (url.includes('/api/genders')) return Promise.resolve({ data: mockGenders });
      if (url.includes('/api/pricing-regions')) return Promise.resolve({ data: mockRegions });
      return Promise.reject(new Error('Not found'));
    });

    render(<ClientsPage />);

    await waitFor(() => {
      expect(screen.getByText('John')).toBeInTheDocument();
      expect(screen.getByText('Doe')).toBeInTheDocument();
    });
  });

  it('should open the create modal and submit form', async () => {
    (apiClient.apiFetch as any).mockResolvedValue({ data: [] });

    render(<ClientsPage />);

    // Assuming there's a button with text "Add Client" or similar
    const addButton = screen.getByRole('button', { name: /add client/i });
    fireEvent.click(addButton);

    expect(screen.getByText(/create client/i)).toBeInTheDocument();

    // Fill form
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Jane' } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Doe' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'jane@example.com' } });
    fireEvent.change(screen.getByLabelText(/ndis number/i), { target: { value: 'NDIS456' } });

    // Mock success response
    (apiClient.apiFetch as any).mockResolvedValueOnce({ data: { id: 2, first_name: 'Jane' } });

    const submitButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(message.success).toHaveBeenCalled();
    });
  });

  it('should handle API errors during submission', async () => {
    (apiClient.apiFetch as any).mockResolvedValue({ data: [] });

    render(<ClientsPage />);

    const addButton = screen.getByRole('button', { name: /add client/i });
    fireEvent.click(addButton);

    (apiClient.apiFetch as any).mockRejectedValueOnce(new Error('Server Error'));

    const submitButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(message.error).toHaveBeenCalledWith('Server Error');
    });
  });
});
