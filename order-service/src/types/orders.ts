export interface CreateOrderPayload {
  supplierId: number;
  description: string;
  deliveryLocation: string;
  credits: number;
  completeBy?: string | null;
  additionalDetails?: string | null;
}

export type EditOrderPayload = Partial<CreateOrderPayload>;
