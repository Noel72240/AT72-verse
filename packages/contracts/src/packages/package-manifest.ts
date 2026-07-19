import type { SemVer } from "../common/primitives.js";

export type PackageKind = "agent" | "skill" | "tool" | "workflow" | "prompt_pack";

export type PackagePricingModel = "free" | "subscription" | "usage";

export interface PackageContractsRequirement {
  min_core: string;
  min_kernel: string;
}

export interface PackageResources {
  entrypoint: string;
  manifests: string[];
}

export interface PackageSignature {
  alg: string;
  digest: string;
  cert_chain_ref?: string;
}

export interface PackagePricing {
  model: PackagePricingModel;
  notes?: string;
}

export interface PackageManifest {
  id: string;
  kind: PackageKind;
  version: SemVer;
  publisher: string;
  display_name: string;
  description: string;
  icons?: string[];
  contracts: PackageContractsRequirement;
  permissions_requested: string[];
  resources: PackageResources;
  signature?: PackageSignature;
  pricing?: PackagePricing;
  categories?: string[];
  tags?: string[];
}
