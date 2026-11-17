import type {
  ButtonHTMLAttributes,
  MouseEventHandler,
  ReactNode,
} from 'react';
import { Link } from 'react-router';
import type { To } from 'react-router';

interface DiagonalSwipeButtonBaseProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly size?: 'default' | 'compact';
  readonly tone?: 'default' | 'on-dark';
  readonly variant?: 'outline' | 'solid';
}

type DiagonalSwipeButtonProps = DiagonalSwipeButtonBaseProps &
  (
    | {
        readonly to: To;
        readonly type?: never;
        readonly onClick?: never;
        readonly disabled?: never;
      }
    | {
        readonly to?: never;
        readonly type?: ButtonHTMLAttributes<HTMLButtonElement>['type'];
        readonly onClick?: MouseEventHandler<HTMLButtonElement>;
        readonly disabled?: boolean;
      }
  );

export function DiagonalSwipeButton(props: DiagonalSwipeButtonProps) {
  const {
    children,
    className = '',
    size = 'default',
    tone = 'default',
    variant = 'outline',
  } = props;
  const classNames = ['diagonal-swipe-button', className].filter(Boolean).join(' ');

  if (props.to !== undefined) {
    return (
      <Link
        className={classNames}
        data-size={size}
        data-tone={tone}
        data-variant={variant}
        to={props.to}
      >
        {children}
      </Link>
    );
  }

  return (
    <button
      className={classNames}
      data-size={size}
      data-tone={tone}
      data-variant={variant}
      disabled={props.disabled}
      onClick={props.onClick}
      type={props.type ?? 'button'}
    >
      {children}
    </button>
  );
}
