import type { ReactNode } from "react";
import { Empty } from "./State";

interface Props {
  title: string;
  endpoint: string;
  minWidth?: number;
  isLoading?: boolean;
  error?: unknown;
  empty?: boolean;
  emptyLabel?: string;
  skeleton: ReactNode;
  children: ReactNode;
}

export function Panel({
  title,
  endpoint,
  minWidth = 240,
  isLoading,
  error,
  empty,
  emptyLabel = "No data",
  skeleton,
  children,
}: Props) {
  const sizeClass = minWidth === 260 ? "flex-[1_1_260px]" : "flex-[1_1_240px]";

  return (
    <div className={`ks-card min-w-0 ${sizeClass}`}>
      <span className="ks-label">{title}</span>
      <div className="ks-endpoint">{endpoint}</div>
      {isLoading || error ? skeleton : empty ? <Empty label={emptyLabel} /> : children}
    </div>
  );
}
