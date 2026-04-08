export declare function createOrder(amount: string, userAddress: string): Promise<{
    payment_url: any;
    payment_request_id: string;
    order_id: string;
}>;
export declare function createReusableOrder(amount: string, userAddress: string): Promise<{
    payment_url: any;
    payment_request_id: string;
    order_id: string;
}>;
export declare function triggerReusablePayment(mandateId: string, amount: string): Promise<{
    status: string;
    payment_request_id: string;
}>;
//# sourceMappingURL=merchantClient.d.ts.map