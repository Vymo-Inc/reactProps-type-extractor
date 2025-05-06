import React from "react";

interface ButtonProps {
  variant: "primary" | "secondary";
  size?: "small" | "medium" | "large";
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

const Button = ({
  variant,
  size = "medium",
  disabled = false,
  onClick,
  children,
}: ButtonProps) => {
  return (
    <button
      className={`btn btn-${variant} btn-${size}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
};

export default Button;
