import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MoreMenu, DeleteProjectDialog, RenameDialog } from '@/components/projects/ManageControls';

describe('MoreMenu', () => {
  it('opens on click and runs the chosen action', () => {
    const onRename = vi.fn();
    render(<MoreMenu label="Actions for Draft" items={[{ label: 'Rename', onSelect: onRename }]} />);
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Actions for Draft' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
    expect(onRename).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('shows why an item is unavailable instead of running it', () => {
    const onDelete = vi.fn();
    render(
      <MoreMenu
        label="Actions"
        items={[{ label: 'Delete project', onSelect: onDelete, disabledReason: 'Only the creator can delete it' }]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
    const item = screen.getByRole('menuitem', { name: /Delete project/ });
    expect(item).toHaveTextContent('Only the creator can delete it');
    fireEvent.click(item);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('closes on Escape', () => {
    render(<MoreMenu label="Actions" items={[{ label: 'Rename', onSelect: () => {} }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Actions' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('DeleteProjectDialog', () => {
  it('only enables delete once the name is typed (ignoring case and spaces)', async () => {
    const onConfirm = vi.fn().mockResolvedValue(true);
    const onClose = vi.fn();
    render(<DeleteProjectDialog isOpen onClose={onClose} projectTitle="My Film" onConfirm={onConfirm} />);
    const button = screen.getByRole('button', { name: 'Delete project' });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'my fil' } });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  my film ' } });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('stays open when deleting fails', async () => {
    const onClose = vi.fn();
    render(<DeleteProjectDialog isOpen onClose={onClose} projectTitle="X" onConfirm={() => Promise.resolve(false)} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'X' } });
    fireEvent.click(screen.getByRole('button', { name: 'Delete project' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete project' })).toBeEnabled());
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('RenameDialog', () => {
  it('saves the trimmed new name and ignores an unchanged one', async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(<RenameDialog isOpen onClose={() => {}} title="Rename project" label="Project name" initialValue="Old" onSave={onSave} />);
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  New name  ' } });
    fireEvent.click(save);
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('New name'));
  });
});
