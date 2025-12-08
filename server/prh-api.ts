/**
 * PRH (Finnish Patent and Registration Office) API Integration
 * 
 * Free API endpoints:
 * - https://avoindata.prh.fi/bis/v1 - Company basic data
 * - https://avoindata.prh.fi/tr/v1 - Trade register
 * 
 * Documentation: https://avoindata.prh.fi/ytj.html
 */

import { PrhCompanyData, savePrhData, getCompanyByName, createCompany, updateCompanyById } from "./db";

const PRH_BIS_BASE_URL = "https://avoindata.prh.fi/bis/v1";

interface PrhBisResult {
  businessId: string;
  name: string;
  registrationDate: string;
  companyForm: string;
  detailsUri: string;
  liquidations?: Array<{
    version: number;
    registrationDate: string;
    endDate: string | null;
    language: string;
    type: string;
    source: number;
  }>;
  names?: Array<{
    order: number;
    version: number;
    name: string;
    registrationDate: string;
    endDate: string | null;
    source: number;
  }>;
  auxiliaryNames?: Array<any>;
  addresses?: Array<{
    careOf: string | null;
    street: string | null;
    postCode: string | null;
    city: string | null;
    language: string;
    type: number;
    version: number;
    registrationDate: string;
    endDate: string | null;
    country: string | null;
    source: number;
  }>;
  companyForms?: Array<{
    version: number;
    name: string;
    language: string;
    type: string;
    registrationDate: string;
    endDate: string | null;
    source: number;
  }>;
  businessLines?: Array<{
    order: number;
    version: number;
    code: string;
    name: string;
    language: string;
    registrationDate: string;
    endDate: string | null;
    source: number;
  }>;
  languages?: Array<any>;
  registeredOffices?: Array<{
    order: number;
    version: number;
    name: string;
    language: string;
    registrationDate: string;
    endDate: string | null;
    source: number;
  }>;
  contactDetails?: Array<{
    version: number;
    value: string;
    type: string;
    registrationDate: string;
    endDate: string | null;
    language: string;
    source: number;
  }>;
  registeredEntries?: Array<any>;
  businessIdChanges?: Array<any>;
}

interface PrhSearchResponse {
  type: string;
  version: string;
  totalResults: number;
  resultsFrom: number;
  previousResultsUri: string | null;
  nextResultsUri: string | null;
  exceptionNoticeUri: string | null;
  results: PrhBisResult[];
}

/**
 * Search companies by Y-tunnus (Business ID)
 */
export async function searchByYTunnus(yTunnus: string): Promise<PrhBisResult | null> {
  try {
    // Clean Y-tunnus format (accept both 1234567-8 and 12345678)
    const cleanYTunnus = yTunnus.replace(/[^0-9-]/g, '');
    
    const url = `${PRH_BIS_BASE_URL}/${cleanYTunnus}`;
    console.log(`[PRH] Fetching company data for Y-tunnus: ${cleanYTunnus}`);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`[PRH] No company found with Y-tunnus: ${cleanYTunnus}`);
        return null;
      }
      throw new Error(`PRH API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as PrhSearchResponse;
    
    if (data.results && data.results.length > 0) {
      console.log(`[PRH] Found company: ${data.results[0].name}`);
      return data.results[0];
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
export async function searchByCompanyName(name: string, maxResults: number = 10): Promise<PrhBisResult[]> {
  try {
    const encodedName = encodeURIComponent(name);
    const url = `${PRH_BIS_BASE_URL}?name=${encodedName}&maxResults=${maxResults}`;
    console.log(`[PRH] Searching companies with name: ${name}`);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });

    // 404 means no results found - not an error
    if (response.status === 404) {
      console.log(`[PRH] No companies found with name: ${name}`);
      return [];
    }

    if (!response.ok) {
      console.error(`[PRH] API error: ${response.status} ${response.statusText}`);
      return []; // Return empty array instead of throwing
    }
    }

    const data = await response.json() as PrhSearchResponse;
    console.log(`[PRH] Found ${data.totalResults} companies matching "${name}"`);
    
    return data.results || [];
  } catch (error) {
    console.error('[PRH] Error searching companies:', error);
    throw error;
  }
}

/**
 * Parse PRH result into our data format
 */
export function parsePrhResult(result: PrhBisResult): PrhCompanyData {
  // Get active business line (no endDate)
  const activeBusinessLine = result.businessLines?.find(bl => !bl.endDate && bl.language === 'FI');
  
  // Get website from contact details
  const website = result.contactDetails?.find(cd => cd.type === 'Kotisivun www-osoite' && !cd.endDate)?.value;
  
  // Check for liquidation
  const hasLiquidation = result.liquidations?.some(l => !l.endDate) || false;
  
  // Get company form
  const companyForm = result.companyForms?.find(cf => !cf.endDate && cf.language === 'FI')?.name || result.companyForm;

  return {
    yTunnus: result.businessId,
    companyName: result.name,
    companyForm,
    registrationDate: result.registrationDate ? new Date(result.registrationDate) : undefined,
    businessLine: activeBusinessLine?.name,
    businessLineCode: activeBusinessLine?.code,
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
      // Create new company
      company = await createCompany({
        name: prhData.companyName,
        yTunnus: prhData.yTunnus,
        industry: prhData.businessLine,
        domain: prhData.website?.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
      });
      console.log(`[PRH] Created new company: ${prhData.companyName} (ID: ${company.id})`);
    } else {
      // Update existing company with Y-tunnus if missing
      if (!company.yTunnus) {
        await updateCompanyById(company.id, { yTunnus: prhData.yTunnus });
      }
    }

    // Save PRH data
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
}>> {
  try {
    const results = await searchByCompanyName(searchTerm, 20);
    
    return results.map(r => {
      const parsed = parsePrhResult(r);
      return {
        yTunnus: r.businessId,
        name: r.name,
        industry: parsed.businessLine,
        companyForm: parsed.companyForm,
        liquidation: parsed.liquidation
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
    
    const hasLiquidation = result.liquidations?.some(l => !l.endDate) || false;
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
): Promise<PrhBisResult[]> {
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
