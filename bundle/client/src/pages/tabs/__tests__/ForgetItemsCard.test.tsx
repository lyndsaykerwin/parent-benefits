import React from 'react';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { ForgetItemsCard } from '../Extras';

afterEach(cleanup);

const open = () => fireEvent.click(screen.getByRole('button', { name: /forget my items/i }));

describe('ForgetItemsCard', () => {
  it('does nothing until the parent confirms, and the confirm step says in plain words what is deleted', () => {
    const forget = jest.fn(async () => 2);
    render(<ForgetItemsCard familyId="maya" forget={forget} />);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    open();
    const box = screen.getByRole('alertdialog');
    expect(box.textContent).toMatch(/delete/i);
    expect(box.textContent).toMatch(/cannot be undone/i);
    expect(forget).not.toHaveBeenCalled();
  });

  it('"Keep my items" closes the box without deleting anything', () => {
    const forget = jest.fn(async () => 2);
    render(<ForgetItemsCard familyId="maya" forget={forget} />);
    open();
    fireEvent.click(screen.getByRole('button', { name: /keep my items/i }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(forget).not.toHaveBeenCalled();
  });

  it('confirming deletes for this family and says how many were removed', async () => {
    const forget = jest.fn(async () => 2);
    render(<ForgetItemsCard familyId="maya" forget={forget} />);
    open();
    fireEvent.click(screen.getByRole('button', { name: /yes, delete/i }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/removed 2 items/i));
    expect(forget).toHaveBeenCalledWith('maya');
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('says so plainly when there was nothing saved', async () => {
    render(<ForgetItemsCard familyId="maya" forget={async () => 0} />);
    open();
    fireEvent.click(screen.getByRole('button', { name: /yes, delete/i }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/did not have any saved items/i));
  });

  it('shows a clear failure message, keeps the button so they can try again, and never claims success', async () => {
    const forget = jest.fn().mockRejectedValueOnce(new Error('Could not remove your items. Please try again.')).mockResolvedValueOnce(1);
    render(<ForgetItemsCard familyId="maya" forget={forget} />);
    open();
    fireEvent.click(screen.getByRole('button', { name: /yes, delete/i }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/could not remove your items/i));
    expect(screen.queryByRole('status')).toBeNull();
    open();
    fireEvent.click(screen.getByRole('button', { name: /yes, delete/i }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/removed 1 item\b/i));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
