export function Button({ className = '', children, ...props }) {
  return <button className={`button ${className}`.trim()} {...props}>{children}</button>;
}
