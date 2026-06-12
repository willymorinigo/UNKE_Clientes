import { Client } from "../types";

/**
 * Deduplicates a list of clients by comparing a normalized key based on their name and email.
 * Keeps the first occurrence (usually oldest or alphabetically first).
 */
export function getUniqueClients(clientsList: Client[]): Client[] {
  const seen = new Set<string>();
  const uniqueList: Client[] = [];

  for (const client of clientsList) {
    if (!client || !client.name) continue;
    
    const nameKey = client.name.trim().toLowerCase();
    const emailKey = client.email ? client.email.trim().toLowerCase() : "";
    
    // Check if the email is a placeholder/default
    const isPlaceholderEmail = 
      emailKey.includes("sin-correo") || 
      emailKey.includes("sin-correo@unke.design") || 
      !emailKey;
      
    // If it's a placeholder, deduplicate purely by normalized name, otherwise by email
    const key = isPlaceholderEmail ? `name_${nameKey}` : `email_${emailKey}`;

    if (!seen.has(key)) {
      seen.add(key);
      uniqueList.push(client);
    }
  }
  return uniqueList;
}

/**
 * Creates a mapping from duplicate client IDs to the canonical client ID.
 * If client B is a duplicate of client A, mapping["B"] = "A".
 */
export function getClientMapping(clientsList: Client[]): Record<string, string> {
  const seenKeys = new Map<string, string>(); // key -> canonicalClientId
  const mapping: Record<string, string> = {};

  for (const client of clientsList) {
    if (!client || !client.name) continue;

    const nameKey = client.name.trim().toLowerCase();
    const emailKey = client.email ? client.email.trim().toLowerCase() : "";
    
    const isPlaceholderEmail = 
      emailKey.includes("sin-correo") || 
      emailKey.includes("sin-correo@unke.design") || 
      !emailKey;
      
    const key = isPlaceholderEmail ? `name_${nameKey}` : `email_${emailKey}`;

    if (!seenKeys.has(key)) {
      seenKeys.set(key, client.id);
      mapping[client.id] = client.id;
    } else {
      const canonicalId = seenKeys.get(key)!;
      mapping[client.id] = canonicalId;
    }
  }
  return mapping;
}
