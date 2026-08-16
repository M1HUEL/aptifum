import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../../src/i18n';
import {
  Badge,
  DataTable,
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  PageHeader,
  Pagination,
  Skeleton,
  StatusSelect,
  TableSkeleton,
  type Column,
} from '../../src/components/ui';
import { Card, CardContent, CardHeader, CardTitle } from '../../src/components/ui/card';

beforeAll(async () => {
  await i18n.changeLanguage('en');
});

describe('Badge', () => {
  it('renders children with a neutral tone by default', () => {
    render(<Badge>Active</Badge>);
    const badge = screen.getByText('Active');
    expect(badge.className).toContain('badge-neutral');
  });

  it('applies the given tone', () => {
    render(<Badge tone="danger">Danger</Badge>);
    expect(screen.getByText('Danger').className).toContain('badge-danger');
  });
});

describe('PageHeader', () => {
  it('renders title and subtitle', () => {
    render(<PageHeader title="Customers" subtitle="All customers" />);
    expect(screen.getByRole('heading', { name: 'Customers' })).toBeInTheDocument();
    expect(screen.getByText('All customers')).toBeInTheDocument();
  });

  it('omits the subtitle when not provided', () => {
    render(<PageHeader title="Customers" />);
    expect(screen.getByRole('heading', { name: 'Customers' })).toBeInTheDocument();
    expect(screen.queryByRole('paragraph')).not.toBeInTheDocument();
  });
});

describe('Card', () => {
  it('renders an optional title and content', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Revenue</CardTitle>
        </CardHeader>
        <CardContent>content</CardContent>
      </Card>,
    );
    expect(screen.getByText('Revenue')).toBeInTheDocument();
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('renders children without a title', () => {
    render(<Card>just content</Card>);
    expect(screen.getByText('just content')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument();
  });
});

describe('ErrorBanner', () => {
  it('renders the message', () => {
    render(<ErrorBanner message="Something went wrong" />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });
});

describe('EmptyState', () => {
  it('renders the message', () => {
    render(<EmptyState message="No results" />);
    expect(screen.getByText('No results')).toBeInTheDocument();
  });
});

describe('LoadingBlock', () => {
  it('renders a spinner with an accessible label', () => {
    render(<LoadingBlock />);
    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
  });
});

describe('Skeleton', () => {
  it('renders with the skeleton class', () => {
    render(<Skeleton className="skeleton-header" />);
    expect(document.querySelector('.skeleton-header')).not.toBeNull();
  });
});

describe('TableSkeleton', () => {
  it('renders the requested number of columns and rows', () => {
    const { container } = render(<TableSkeleton columns={3} rows={2} />);
    expect(container.querySelectorAll('thead th').length).toBe(3);
    expect(container.querySelectorAll('tbody tr').length).toBe(2);
  });
});

interface User {
  id: number;
  name: string;
  active: boolean;
}

describe('DataTable', () => {
  const columns: Column<User>[] = [
    { key: 'name', header: 'Name' },
    { key: 'active', header: 'Status', render: (row) => (row.active ? 'Yes' : 'No') },
  ];

  it('renders an empty state when there are no rows', () => {
    render(<DataTable columns={columns} rows={[]} rowKey={(row) => String(row.id)} />);
    expect(screen.getByText('No data to display.')).toBeInTheDocument();
  });

  it('renders headers and raw values', () => {
    render(
      <DataTable columns={columns} rows={[{ id: 1, name: 'Alice', active: false }]} rowKey={(row) => String(row.id)} />,
    );
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('uses the render function per column', () => {
    render(
      <DataTable columns={columns} rows={[{ id: 1, name: 'Alice', active: true }]} rowKey={(row) => String(row.id)} />,
    );
    expect(screen.getByText('Yes')).toBeInTheDocument();
  });
});

describe('Pagination', () => {
  it('disables Previous on the first page and shows the range', () => {
    render(<Pagination page={1} limit={20} total={137} onPage={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
    expect(screen.getByText('Showing 1–20 of 137')).toBeInTheDocument();
  });

  it('disables Next on the last page', () => {
    render(<Pagination page={7} limit={20} total={137} onPage={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('calls onPage with the next page', async () => {
    const onPage = vi.fn();
    const user = userEvent.setup();
    render(<Pagination page={2} limit={20} total={137} onPage={onPage} />);
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(onPage).toHaveBeenCalledWith(3);
  });

  it('calls onLimit when the rows-per-page select changes', async () => {
    const onLimit = vi.fn();
    const user = userEvent.setup();
    render(<Pagination page={1} limit={20} total={137} onPage={vi.fn()} onLimit={onLimit} />);
    await user.selectOptions(screen.getByLabelText('Rows per page'), '50');
    expect(onLimit).toHaveBeenCalledWith(50);
  });
});

describe('StatusSelect', () => {
  const options = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ];

  it('renders all options', () => {
    render(<StatusSelect value="active" onChange={vi.fn()} options={options} ariaLabel="Status" />);
    const select = screen.getByLabelText('Status');
    expect(select).toBeInTheDocument();
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Active', 'Inactive']);
  });

  it('calls onChange when the selection changes', () => {
    const onChange = vi.fn();
    render(<StatusSelect value="active" onChange={onChange} options={options} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'inactive' } });
    expect(onChange).toHaveBeenCalledWith('inactive');
  });
});
