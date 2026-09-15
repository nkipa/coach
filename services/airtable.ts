import { SavedSession, AirtableConfig, VerificationResult } from '../types';

export const verifyAirtableConnection = async (config: AirtableConfig): Promise<VerificationResult> => {
  try {
    const baseIdMatch = config.baseId.trim().match(/(app[a-zA-Z0-9]+)/);
    const cleanBaseId = baseIdMatch ? baseIdMatch[0] : config.baseId.trim();
    const encodedTable = encodeURIComponent(config.tableName);
    
    // 1. READ CHECK
    console.log(`[Airtable] Verifying Read Access: Base=${cleanBaseId}, Table=${config.tableName}`);
    const readResponse = await fetch(`https://api.airtable.com/v0/${cleanBaseId}/${encodedTable}?maxRecords=1`, {
      headers: { Authorization: `Bearer ${config.apiKey}` }
    });

    if (!readResponse.ok) {
      const errData = await readResponse.json().catch(() => ({}));
      const apiMsg = errData.error?.message || errData.error || "Unknown API Error";
      return { 
        success: false, 
        message: `Error ${readResponse.status}: ${apiMsg}` 
      };
    }

    // 2. SCHEMA & WRITE CHECK (Critical Step)
    const testRecord = {
        fields: {
            "SessionId": "CONNECTION_TEST",
            "UserId": "TEST",
            "Content": "{}" 
        }
    };

    console.log(`[Airtable] Verifying Write Access & Schema...`);
    const writeResponse = await fetch(`https://api.airtable.com/v0/${cleanBaseId}/${encodedTable}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(testRecord)
    });

    if (!writeResponse.ok) {
        const errData = await writeResponse.json().catch(() => ({}));
        const msg = errData.error?.message || JSON.stringify(errData);
        
        // Airtable returns "Unknown field name" (422) if columns are missing
        if (msg.includes("Unknown field") || writeResponse.status === 422) {
             return { 
                 success: false, 
                 message: "Schema Mismatch: Missing required columns.",
                 missingFields: true
             };
        }
        
        return { success: false, message: `Write Error (${writeResponse.status}): ${msg}` };
    }

    // 3. CLEANUP (Delete the test record)
    const writeData = await writeResponse.json();
    if (writeData.id) {
        await fetch(`https://api.airtable.com/v0/${cleanBaseId}/${encodedTable}/${writeData.id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${config.apiKey}` }
        });
    }

    return { success: true };

  } catch (e: any) {
    console.error("Airtable verification failed", e);
    return { success: false, message: e.message || "Network request failed." };
  }
};

export const fetchRemoteHistory = async (config: AirtableConfig, userId: string): Promise<SavedSession[]> => {
  try {
    const baseIdMatch = config.baseId.trim().match(/(app[a-zA-Z0-9]+)/);
    const cleanBaseId = baseIdMatch ? baseIdMatch[0] : config.baseId.trim();

    const encodedTable = encodeURIComponent(config.tableName);
    // Formula: {UserId} = 'userId'
    const filter = encodeURIComponent(`{UserId}='${userId}'`);
    const response = await fetch(`https://api.airtable.com/v0/${cleanBaseId}/${encodedTable}?filterByFormula=${filter}`, {
      headers: {
        Authorization: `Bearer ${config.apiKey}`
      }
    });

    if (!response.ok) return [];

    const data = await response.json();
    return data.records.map((record: any) => {
      try {
        const content = JSON.parse(record.fields.Content);
        // Inject Airtable Record ID for future updates
        return { 
          ...content, 
          _airtableId: record.id,
          messages: content.messages.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp)
          }))
        };
      } catch (e) {
        return null;
      }
    }).filter(Boolean);
  } catch (e) {
    console.error("Airtable fetch error", e);
    return [];
  }
};

export const saveRemoteSession = async (config: AirtableConfig, userId: string, session: SavedSession) => {
  try {
    const baseIdMatch = config.baseId.trim().match(/(app[a-zA-Z0-9]+)/);
    const cleanBaseId = baseIdMatch ? baseIdMatch[0] : config.baseId.trim();
    const encodedTable = encodeURIComponent(config.tableName);

    // Filter out internal ID for clean storage
    // We remove _airtableId from the content JSON to avoid circular references or stale IDs inside the JSON blob
    const { _airtableId, ...restSession } = session;
    
    // Attempt to save session including attachments (User request: persistence over size safety)
    const safeSession = {
      ...restSession,
      messages: session.messages // Preserve attachments
    };

    const payload = {
      fields: {
        SessionId: safeSession.sessionId,
        UserId: userId,
        Content: JSON.stringify(safeSession)
      }
    };

    let recordId = _airtableId;

    // 1. If we have a Record ID, try to PATCH (Update)
    if (recordId) {
      const updateRes = await fetch(`https://api.airtable.com/v0/${cleanBaseId}/${encodedTable}/${recordId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (updateRes.ok) {
        return; // Success
      } else if (updateRes.status === 404) {
        // Record was deleted in Airtable? Fallback to create/search.
        console.warn("Record not found (404) during update. Creating new record...");
        recordId = undefined; 
      } else {
         const err = await updateRes.json();
         console.error("Airtable Update Failed:", err);
      }
    }

    // 2. If no ID (or PATCH failed 404), try to Find by SessionId to avoid duplicates
    if (!recordId) {
      const filter = encodeURIComponent(`{SessionId}='${safeSession.sessionId}'`);
      const searchRes = await fetch(`https://api.airtable.com/v0/${cleanBaseId}/${encodedTable}?filterByFormula=${filter}`, {
        headers: { Authorization: `Bearer ${config.apiKey}` }
      });
      
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.records && searchData.records.length > 0) {
          recordId = searchData.records[0].id;
          // Found existing record, update it
          const updateRes = await fetch(`https://api.airtable.com/v0/${cleanBaseId}/${encodedTable}/${recordId}`, {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${config.apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });
          if (updateRes.ok) return;
        }
      }
    }

    // 3. If still no ID, create new record (POST)
    if (!recordId) {
      const createRes = await fetch(`https://api.airtable.com/v0/${cleanBaseId}/${encodedTable}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (!createRes.ok) {
          const err = await createRes.json();
          console.error("Airtable Create Failed:", err);
      }
    }

  } catch (e) {
    console.error("Airtable save error", e);
  }
};

export const deleteRemoteSession = async (config: AirtableConfig, sessionId: string) => {
  try {
    const baseIdMatch = config.baseId.trim().match(/(app[a-zA-Z0-9]+)/);
    const cleanBaseId = baseIdMatch ? baseIdMatch[0] : config.baseId.trim();
    const encodedTable = encodeURIComponent(config.tableName);
    
    const filter = encodeURIComponent(`{SessionId}='${sessionId}'`);
    const searchRes = await fetch(`https://api.airtable.com/v0/${cleanBaseId}/${encodedTable}?filterByFormula=${filter}`, {
      headers: { Authorization: `Bearer ${config.apiKey}` }
    });
    const searchData = await searchRes.json();
    
    if (searchData.records && searchData.records.length > 0) {
      const recordId = searchData.records[0].id;
      await fetch(`https://api.airtable.com/v0/${cleanBaseId}/${encodedTable}/${recordId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${config.apiKey}` }
      });
    }
  } catch (e) {
    console.error("Airtable delete error", e);
  }
};