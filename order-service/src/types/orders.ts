export interface CreateOrderPayload {
  supplierId: string;
  description: string;
  deliveryLocation: string;
  credits: number;
  completeBy?: string | null;
  additionalDetails?: string | null;
}
