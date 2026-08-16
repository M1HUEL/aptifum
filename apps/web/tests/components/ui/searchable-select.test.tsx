import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../../../src/i18n';
import { SearchableSelect } from '../../../src/components/ui/searchable-select';

const options = [
  { value: '1', label: 'Laptop Dell' },
  { value: '2', label: 'Monitor LG' },
];

beforeAll(async () => {
  await i18n.changeLanguage('en');
  if (typeof Element.prototype.hasPointerCapture !== 'function') {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.setPointerCapture = () => {};
  }
  if (typeof Element.prototype.scrollIntoView !== 'function') {
    Element.prototype.scrollIntoView = () => {};
  }
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('SearchableSelect', () => {
  it('filters options while typing in the search input', async () => {
    const user = userEvent.setup();
    render(<SearchableSelect value="" onChange={vi.fn()} options={options} />);

    await user.click(screen.getByRole('combobox'));
    const searchInput = await screen.findByLabelText('Search…');
    await user.type(searchInput, 'dell');

    expect(await screen.findByText('Laptop Dell')).toBeInTheDocument();
    expect(screen.queryByText('Monitor LG')).not.toBeInTheDocument();
  });

  it('calls onChange with the selected value when an option is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SearchableSelect value="" onChange={onChange} options={options} />);

    await user.click(screen.getByRole('combobox'));
    const searchInput = await screen.findByLabelText('Search…');
    await user.type(searchInput, 'dell');
    await user.click(await screen.findByText('Laptop Dell'));

    expect(onChange).toHaveBeenCalledWith('1');
  });

  it('shows every option when the search is cleared', async () => {
    const user = userEvent.setup();
    render(<SearchableSelect value="" onChange={vi.fn()} options={options} />);

    await user.click(screen.getByRole('combobox'));
    const searchInput = await screen.findByLabelText('Search…');
    await user.type(searchInput, 'dell');

    expect(await screen.findByText('Laptop Dell')).toBeInTheDocument();
    expect(screen.queryByText('Monitor LG')).not.toBeInTheDocument();

    await user.clear(searchInput);

    expect(await screen.findByText('Monitor LG')).toBeInTheDocument();
    expect(screen.getByText('Laptop Dell')).toBeInTheDocument();
  });
});
