import { createRef } from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { i18n } from '@/i18n';
import { Checkbox, Select, TextField } from '@/components/ui';

afterEach(cleanup);

const describedByText = (element: HTMLElement): string[] =>
  (element.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent ?? `<missing #${id}>`);

describe('TextField', () => {
  it('associates the label with the input', async () => {
    render(<TextField label="Họ và tên" />);

    const input = screen.getByLabelText('Họ và tên');
    await userEvent.type(input, 'Nguyễn Văn An');
    expect((input as HTMLInputElement).value).toBe('Nguyễn Văn An');
  });

  it('links helper text through aria-describedby and is not invalid by default', () => {
    render(<TextField label="Email" helperText="Chúng tôi sẽ gửi liên kết xác minh." />);

    const input = screen.getByLabelText('Email');
    expect(describedByText(input)).toEqual(['Chúng tôi sẽ gửi liên kết xác minh.']);
    expect(input.hasAttribute('aria-invalid')).toBe(false);
  });

  it('sets aria-invalid and describes the input with both helper and error', () => {
    render(
      <TextField
        label="Email"
        helperText="Email công việc"
        error="Vui lòng nhập email hợp lệ."
        aria-describedby="external-hint"
      />
    );

    const input = screen.getByLabelText('Email');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')?.split(' ')[0]).toBe('external-hint');
    expect(describedByText(input).slice(1)).toEqual([
      'Email công việc',
      'Vui lòng nhập email hợp lệ.',
    ]);
  });

  it('marks the input as required', () => {
    render(<TextField label="Họ và tên" required />);
    expect((screen.getByLabelText('Họ và tên') as HTMLInputElement).required).toBe(true);
  });

  it('keeps a caller-provided id', () => {
    render(<TextField label="Mã số thuế" id="tax-id" />);
    expect(screen.getByLabelText('Mã số thuế').id).toBe('tax-id');
  });

  it('password: toggles visibility with an i18n-labelled button', async () => {
    render(<TextField label="Mật khẩu" type="password" defaultValue="secret" />);

    const input = screen.getByLabelText('Mật khẩu') as HTMLInputElement;
    expect(input.type).toBe('password');

    const toggle = screen.getByRole('button', { name: 'Hiện mật khẩu' });
    expect(toggle.getAttribute('aria-controls')).toBe(input.id);

    await userEvent.click(toggle);
    expect(input.type).toBe('text');
    expect(screen.getByRole('button', { name: 'Ẩn mật khẩu' })).toBeDefined();

    await userEvent.click(screen.getByRole('button', { name: 'Ẩn mật khẩu' }));
    expect(input.type).toBe('password');
  });

  it('password: the toggle label follows the current language', async () => {
    await i18n.changeLanguage('en');
    render(<TextField label="Password" type="password" />);
    expect(screen.getByRole('button', { name: 'Show password' })).toBeDefined();
  });

  it('does not render a toggle for non-password inputs', () => {
    render(<TextField label="Email" type="email" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('size="lg": keeps the password toggle working and does not leak size to the <input>', async () => {
    render(<TextField label="Mật khẩu" type="password" size="lg" />);
    const input = screen.getByLabelText('Mật khẩu');
    expect(input.hasAttribute('size')).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: 'Hiện mật khẩu' }));
    expect(input.getAttribute('type')).toBe('text');
  });

  it('password with passwordToggle="text": shows "Hiện"/"Ẩn" named after what it does', async () => {
    render(<TextField label="Mật khẩu" type="password" size="xl" passwordToggle="text" />);
    const input = screen.getByLabelText('Mật khẩu');

    const toggle = screen.getByRole('button', { name: 'Hiện mật khẩu' });
    expect(toggle.textContent).toBe('Hiện');
    await userEvent.click(toggle);

    expect(input.getAttribute('type')).toBe('text');
    expect(screen.getByRole('button', { name: 'Ẩn mật khẩu' }).textContent).toBe('Ẩn');
  });

  it('renders a labelAction next to the label without changing the label', async () => {
    render(
      <TextField label="Mật khẩu" type="password" labelAction={<button>Quên mật khẩu?</button>} />
    );

    expect(screen.getByLabelText('Mật khẩu').tagName).toBe('INPUT');
    expect(screen.getByRole('button', { name: 'Quên mật khẩu?' })).toBeDefined();
  });

  it('forwards the ref to the <input>', () => {
    const ref = createRef<HTMLInputElement>();
    render(<TextField ref={ref} label="Email" />);
    expect(ref.current).toBe(screen.getByLabelText('Email'));
  });
});

describe('Select', () => {
  const renderSelect = (props: Partial<React.ComponentProps<typeof Select>> = {}) =>
    render(
      <Select label="Trạng thái" placeholder="Chọn trạng thái" defaultValue="" {...props}>
        <option value="draft">Bản nháp</option>
        <option value="published">Đã xuất bản</option>
      </Select>
    );

  it('is a native combobox labelled by its label', async () => {
    renderSelect();

    const select = screen.getByRole('combobox', { name: 'Trạng thái' }) as HTMLSelectElement;
    expect(select.value).toBe('');

    await userEvent.selectOptions(select, 'published');
    expect(select.value).toBe('published');
  });

  it('renders the placeholder as a disabled option', () => {
    renderSelect();
    const placeholder = screen.getByRole('option', {
      name: 'Chọn trạng thái',
    }) as HTMLOptionElement;
    expect(placeholder.disabled).toBe(true);
  });

  it('exposes error and helper text through aria-*', () => {
    renderSelect({ helperText: 'Chỉ hiển thị cho giảng viên', error: 'Vui lòng chọn trạng thái.' });

    const select = screen.getByRole('combobox', { name: 'Trạng thái' });
    expect(select.getAttribute('aria-invalid')).toBe('true');
    expect(describedByText(select)).toEqual([
      'Chỉ hiển thị cho giảng viên',
      'Vui lòng chọn trạng thái.',
    ]);
  });

  it('supports required and disabled', () => {
    renderSelect({ required: true, disabled: true });
    const select = screen.getByRole('combobox', { name: 'Trạng thái' }) as HTMLSelectElement;
    expect(select.required).toBe(true);
    expect(select.disabled).toBe(true);
  });

  it('forwards the ref', () => {
    const ref = createRef<HTMLSelectElement>();
    render(
      <Select ref={ref} label="Loại">
        <option>Public</option>
      </Select>
    );
    expect(ref.current).toBe(screen.getByRole('combobox', { name: 'Loại' }));
  });
});

describe('Checkbox', () => {
  it('toggles when its label is clicked', async () => {
    render(<Checkbox label="Gửi email nhắc nhở" />);

    const checkbox = screen.getByRole('checkbox', {
      name: 'Gửi email nhắc nhở',
    }) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    await userEvent.click(screen.getByText('Gửi email nhắc nhở'));
    expect(checkbox.checked).toBe(true);
  });

  it('toggles with the keyboard (Space)', async () => {
    render(<Checkbox label="Đồng ý" />);
    const checkbox = screen.getByRole('checkbox', { name: 'Đồng ý' }) as HTMLInputElement;

    checkbox.focus();
    await userEvent.keyboard(' ');
    expect(checkbox.checked).toBe(true);
  });

  it('exposes error text and aria-invalid', () => {
    render(<Checkbox label="Đồng ý điều khoản" error="Bạn cần đồng ý để tiếp tục." required />);

    const checkbox = screen.getByRole('checkbox', { name: 'Đồng ý điều khoản' });
    expect(checkbox.getAttribute('aria-invalid')).toBe('true');
    expect((checkbox as HTMLInputElement).required).toBe(true);
    expect(describedByText(checkbox)).toEqual(['Bạn cần đồng ý để tiếp tục.']);
  });

  it('cannot be toggled when disabled', async () => {
    render(<Checkbox label="Khóa khóa học" disabled />);
    const checkbox = screen.getByRole('checkbox', { name: 'Khóa khóa học' }) as HTMLInputElement;

    await userEvent.click(checkbox);
    expect(checkbox.checked).toBe(false);
  });

  it('forwards the ref', () => {
    const ref = createRef<HTMLInputElement>();
    render(<Checkbox ref={ref} label="Đồng ý" />);
    expect(ref.current).toBe(screen.getByRole('checkbox', { name: 'Đồng ý' }));
  });
});
