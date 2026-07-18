import { ProductShell } from "../product-shell";
import { awsRuntimeConfig } from "../aws-runtime-config";

export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <ProductShell configurationInput={awsRuntimeConfig()}>{children}</ProductShell>;
}
