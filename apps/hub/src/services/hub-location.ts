interface HubLocation {
    ip: string;
    city: string;
    country: string;
    countryCode: string;
};

let cached: HubLocation | null = null;

export async function initLocation(): Promise<void> {
    try {
        const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(5_000) })
        const data = await res.json() as Record<string, string>;
        cached = {
            ip: data.ip,
            city: data.city ?? 'Unknown',
            country: data.country_name ?? 'Unknown',
            countryCode: data.county_code ?? 'XX',
        }
    } catch {
        // no internet or rate limited
    }
}

export function getLocation(): HubLocation | null {
    return cached;
}