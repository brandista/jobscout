/**
 * PRH (Finnish Patent and Registration Office) API Integration
 *
 * API v3 endpoint (YTJ Open Data):
 * - https://avoindata.prh.fi/opendata-ytj-api/v3/companies
 *
 * Documentation: https://avoindata.prh.fi/ytj.html
 */

import { PrhCompanyData, savePrhData, getCompanyByName, createCompany, updateCompanyById } from "./db";

const PRH_API_BASE_URL = "https://avoindata.prh.fi/opendata-ytj-api/v3";

// --- v3 API types ---

interface PrhMultilangDesc {
  languageCode: string;
  description: string;
}

interface PrhCompanyV3 {
  businessId: {
    value: string;
    registrationDate: string;
    source: string;
  };
  euId?: {
    value: string;
    source: string;
  };
  names: Array<{
    name: string;
    type: string;
    registrationDate: string;
    endDate?: string | null;
    version: number;
    source: string;
  }>;
  mainBusinessLine?: {
    type: number;
    descriptions: PrhMultilangDesc[];
    typeCodeSet: string;
    registrationDate: string;
    source: string;
  };
  companyForms?: Array<{
    type: string;
    descriptions: PrhMultilangDesc[];
    registrationDate: string;
    endDate?: string | null;
    source: string;
    version: number;
  }>;
  companySituations?: Array<{
    type: string;
    descriptions: PrhMultilangDesc[];
    registrationDate: string;
    endDate?: string | null;
    source: string;
  }>;
  registeredEntries?: Array<{
    type: number;
    descriptions: PrhMultilangDesc[];
    registrationDate: string;
    endDate?: string | null;
    register: string;
    authority: string;
  }>;
  addresses?: Array<{
    type: number;
    street: string;
    postCode: string;
    postOffices?: Array<{
      city: string;
      languageCode: string;
    }>;
    buildingNumber?: string;
    co?: string;
    registrationDate: string;
    source: string;
  }>;
  website?: {
    url: string;
    registrationDate: string;
    source: string;
  };
  tradeRegisterStatus?: string;
  status?: string;
  registrationDate: string;
  lastModified: string;
  endDate?: string | null;
}

interface PrhSearchResponseV3 {
  totalResults: number;
  companies: PrhCompanyV3[];
}

// Helper: get Finnish description from multilang array
function getFiDesc(descs?: PrhMultilangDesc[]): string | undefined {
  if (!descs || descs.length === 0) return undefined;
  return descs.find(d => d.languageCode === 'fi')?.description
    ?? descs.find(d => d.languageCode === 'en')?.description
    ?? descs[0]?.description;
}

// Helper: get current (active) name from names array
// type "1" = official trading name, no endDate = currently active
function getActiveName(names: PrhCompanyV3['names']): string {
  const active = names.find(n => !n.endDate && n.type === '1');
  return active?.name ?? names.find(n => !n.endDate)?.name ?? names[0]?.name ?? '';
}

/**
 * Search companies by Y-tunnus (Business ID)
 */
export async function searchByYTunnus(yTunnus: string): Promise<PrhCompanyV3 | null> {
  try {
    // Clean Y-tunnus format (accept both 1234567-8 and 12345678)
    const cleanYTunnus = yTunnus.replace(/[^0-9-]/g, '');

    const url = `${PRH_API_BASE_URL}/companies?businessId=${encodeURIComponent(cleanYTunnus)}&maxResults=1`;
    console.log(`[PRH] Fetching company data for Y-tunnus: ${cleanYTunnus}`);

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`[PRH] No company found with Y-tunnus: ${cleanYTunnus}`);
        return null;
      }
      throw new Error(`PRH API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as PrhSearchResponseV3;

    if (data.companies && data.companies.length > 0) {
      const company = data.companies[0];
      console.log(`[PRH] Found company: ${getActiveName(company.names)}`);
      return company;
    }

    return null;
  } catch (error) {
    console.error('[PRH] Error fetching company data:', error);
    throw error;
  }
}

/**
 * Search companies by name
 */
export async function searchByCompanyName(name: string, maxResults: number = 10): Promise<PrhCompanyV3[]> {
  try {
    const encodedName = encodeURIComponent(name);
    const url = `${PRH_API_BASE_URL}/companies?name=${encodedName}&maxResults=${maxResults}&totalResults=true`;
    console.log(`[PRH] Searching companies with name: ${name}`);

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });

    // 404 means no results found - not an error
    if (response.status === 404) {
      console.log(`[PRH] No companies found with name: ${name}`);
      return [];
    }

    if (!response.ok) {
      console.error(`[PRH] API error: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json() as PrhSearchResponseV3;
    console.log(`[PRH] Found ${data.totalResults} companies matching "${name}"`);

    return data.companies || [];
  } catch (error) {
    console.error('[PRH] Error searching companies:', error);
    throw error;
  }
}

/**
 * Parse PRH v3 result into our data format
 */
export function parsePrhResult(result: PrhCompanyV3): PrhCompanyData {
  // Get main business line description in Finnish
  const businessLineDesc = getFiDesc(result.mainBusinessLine?.descriptions);
  const businessLineCode = result.mainBusinessLine?.type?.toString();

  // Get website URL from result object
  const website = result.website?.url || undefined;

  // Check for liquidation via companySituations
  const hasLiquidation = result.companySituations?.some(
    s => s.type === 'LIQUIDATION' && !s.endDate
  ) || false;

  // Get company form in Finnish
  const activeForm = result.companyForms?.find(cf => !cf.endDate);
  const companyForm = getFiDesc(activeForm?.descriptions);

  return {
    yTunnus: result.businessId.value,
    companyName: getActiveName(result.names),
    companyForm,
    registrationDate: result.registrationDate ? new Date(result.registrationDate) : undefined,
    businessLine: businessLineDesc,
    businessLineCode,
    liquidation: hasLiquidation,
    website,
    rawData: result
  };
}

/**
 * Enrich company with PRH data
 * Creates company if it doesn't exist, updates if it does
 */
export async function enrichCompanyWithPrhData(yTunnus: string): Promise<PrhCompanyData | null> {
  try {
    const prhResult = await searchByYTunnus(yTunnus);

    if (!prhResult) {
      return null;
    }

    const prhData = parsePrhResult(prhResult);

    // Check if company exists in our DB
    let company = await getCompanyByName(prhData.companyName);

    if (!company) {
      company = await createCompany({
        name: prhData.companyName,
        yTunnus: prhData.yTunnus,
        industry: prhData.businessLine,
        domain: prhData.website?.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
      });
      console.log(`[PRH] Created new company: ${prhData.companyName} (ID: ${company.id})`);
    } else {
      if (!company.yTunnus) {
        await updateCompanyById(company.id, { yTunnus: prhData.yTunnus });
      }
    }

    await savePrhData(company.id, prhData);
    console.log(`[PRH] Saved PRH data for company ID: ${company.id}`);

    return prhData;
  } catch (error) {
    console.error('[PRH] Error enriching company:', error);
    return null;
  }
}

/**
 * Search and enrich multiple companies by name
 */
export async function searchAndEnrichCompanies(searchTerm: string): Promise<Array<{
  yTunnus: string;
  name: string;
  industry?: string;
  companyForm?: string;
  liquidation: boolean;
  registrationDate?: string;
  website?: string;
  city?: string;
  status?: string;
}>> {
  try {
    const results = await searchByCompanyName(searchTerm, 20);

    return results.map(r => {
      const parsed = parsePrhResult(r);

      // Get city from first address
      const city = r.addresses?.[0]?.postOffices?.find(
        po => po.languageCode === '1'
      )?.city ?? r.addresses?.[0]?.postOffices?.[0]?.city;

      return {
        yTunnus: r.businessId.value,
        name: getActiveName(r.names),
        industry: parsed.businessLine,
        companyForm: parsed.companyForm,
        liquidation: parsed.liquidation,
        registrationDate: r.registrationDate,
        website: r.website?.url,
        city,
        status: r.status,
      };
    });
  } catch (error) {
    console.error('[PRH] Error in searchAndEnrichCompanies:', error);
    return [];
  }
}

/**
 * Check if company is in liquidation
 */
export async function checkCompanyLiquidation(yTunnus: string): Promise<boolean | null> {
  try {
    const result = await searchByYTunnus(yTunnus);
    if (!result) return null;

    const hasLiquidation = result.companySituations?.some(
      s => s.type === 'LIQUIDATION' && !s.endDate
    ) || false;
    return hasLiquidation;
  } catch (error) {
    console.error('[PRH] Error checking liquidation:', error);
    return null;
  }
}

/**
 * Signal detection: Find companies with recent registration (potential new players)
 */
export async function findRecentlyRegisteredCompanies(
  searchTerm: string,
  withinDays: number = 365
): Promise<PrhCompanyV3[]> {
  try {
    const results = await searchByCompanyName(searchTerm, 50);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - withinDays);

    return results.filter(r => {
      if (!r.registrationDate) return false;
      const regDate = new Date(r.registrationDate);
      return regDate >= cutoffDate;
    });
  } catch (error) {
    console.error('[PRH] Error finding recent companies:', error);
    return [];
  }
}

/**
 * Get company changes/signals from PRH data
 * Compares current data with stored data to detect changes
 */
export async function detectPrhChanges(companyId: number, currentPrhData: PrhCompanyData): Promise<Array<{
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
}>> {
  const changes: Array<{ type: string; description: string; severity: 'low' | 'medium' | 'high' }> = [];
  
  // This would compare with stored PRH data - for now, detect critical states
  
  if (currentPrhData.liquidation) {
    changes.push({
      type: 'liquidation',
      description: `${currentPrhData.companyName} on selvitystilassa`,
      severity: 'high'
    });
  }
  
  return changes;
}
