/**
 * Utility helper to talk to Google Drive API using a Bearer accessToken.
 */

/**
 * Searches for a folder with the given name on Google Drive.
 * If found, returns its folder ID. If not found, creates it and returns the ID.
 */
export async function getOrCreateDriveFolder(
  accessToken: string,
  folderName: string = "UNKE Estudio - Presupuestos"
): Promise<string> {
  try {
    const query = encodeURIComponent(
      `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
    );
    const listUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`;

    const listRes = await fetch(listUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!listRes.ok) {
      const errText = await listRes.text();
      console.error("Google Drive list folders failed:", errText);
      throw new Error(`Error buscando carpeta en Drive: ${listRes.statusText}`);
    }

    const data = await listRes.json();
    if (data.files && data.files.length > 0) {
      // Folder exists! Return the first matching ID.
      return data.files[0].id;
    }

    // Folder does not exist, let's create a new folder
    const createUrl = "https://www.googleapis.com/drive/v3/files";
    const createRes = await fetch(createUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      console.error("Google Drive create folder failed:", errText);
      throw new Error(`Error creando carpeta en Drive: ${createRes.statusText}`);
    }

    const folderData = await createRes.json();
    return folderData.id;
  } catch (error) {
    console.error("Error in getOrCreateDriveFolder:", error);
    throw error;
  }
}

/**
 * Uploads a PDF blob to a designated folder in Google Drive.
 */
export async function uploadPdfToDrive(
  accessToken: string,
  pdfBlob: Blob,
  fileName: string,
  parentFolderId?: string
): Promise<{ id: string; webViewLink: string }> {
  try {
    // Construct the metadata part
    const metadata = {
      name: fileName,
      mimeType: "application/pdf",
      parents: parentFolderId ? [parentFolderId] : undefined,
    };

    // Multipart upload is required when sending both metadata and raw file binaries
    const form = new FormData();
    form.append(
      "metadata",
      new Blob([JSON.stringify(metadata)], { type: "application/json" })
    );
    form.append("file", pdfBlob);

    const uploadUrl = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink";
    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: form,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      console.error("Google Drive PDF multipart upload failed:", errText);
      throw new Error(`Error subiendo archivo PDF a Drive: ${uploadRes.statusText}`);
    }

    const fileDetails = await uploadRes.json();
    return {
      id: fileDetails.id,
      webViewLink: fileDetails.webViewLink,
    };
  } catch (error) {
    console.error("Error raising uploadPdfToDrive helper:", error);
    throw error;
  }
}
