declare module 'selfsigned' {
  export interface SelfSignedCert {
    private: string;
    public: string;
    cert: string;
    fingerprint: string;
  }

  export interface GenerateOptions {
    keySize?: number;
    days?: number;
    keyType?: 'rsa' | 'ecdsa' | 'ed25519';
    algorithm?: string;
    extensions?: Array<Record<string, unknown>>;
  }

  export function generate(
    attrs?: Array<{ name: string; value: string }>,
    options?: GenerateOptions,
  ): Promise<SelfSignedCert>;
}
