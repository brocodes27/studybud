/**
 * Dub.co Affiliate Tracking Utility
 * 
 * This utility provides a wrapper for the Dub.co Analytics script.
 * Ensure the script is loaded in index.html:
 * <script defer data-domain="elevenfolks.com" src="https://dub.sh/js/analytics.js"></script>
 */

declare global {
    interface Window {
        dub?: {
            track: (eventName: string, options?: {
                externalId?: string;
                customerId?: string;
                customerEmail?: string;
                customerName?: string;
                invoiceId?: string;
                amount?: number;
                currency?: string;
                metadata?: Record<string, any>;
            }) => void;
        };
    }
}

/**
 * Track a custom event for Dub.co affiliate attribution.
 * @param eventName The name of the event (e.g., 'signup', 'purchase')
 * @param options Additional data for the event
 */
export const trackDubEvent = (eventName: string, options?: {
    externalId?: string;
    customerId?: string;
    customerEmail?: string;
    customerName?: string;
    invoiceId?: string;
    amount?: number;
    currency?: string;
    metadata?: Record<string, any>;
}) => {
    if (typeof window !== 'undefined' && window.dub) {
        console.log(`[Dub] Tracking event: ${eventName}`, options);
        window.dub.track(eventName, options);
    } else {
        console.warn(`[Dub] Analytics script not loaded. Could not track event: ${eventName}`);
    }
};
