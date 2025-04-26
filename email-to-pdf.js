import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { PDFDocument, PDFCheckBox, PDFTextField } from 'pdf-lib';
import stream from 'stream';
import { authenticate } from './auth.js';

const LABEL_NAME = 'NIE_to_go_NEW';
const PARENT_FOLDER_ID = '1vIoiAHbTcJpv9poySGe6p5EkKnUE3GX3';
const TEMPLATE_PATH = './15-Formulario_NIE_y_certificados.pdf';

// 🧠 Translations
const translations = {
  reasons: {
    'buying a house': 'comprar una casa',
    'working in spain': 'trabajar en España',
    'study': 'estudiar',
    'retirement': 'jubilación',
    'een huis kopen': 'comprar una casa',
    'aankoop woning': 'comprar una casa',
    'werk': 'trabajo',
    'job relocation': 'traslado laboral'
  },
  nationalities: {
    'dutch': 'neerlandesa',
    'norwegian': 'noruega',
    'belgian': 'belga',
    'nederlandse': 'neerlandesa'
  },
  countries: {
    'netherlands': 'Países Bajos',
    'nederland': 'Países Bajos',
    'norway': 'Noruega',
    'belgium': 'Bélgica'
  },
  months: [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ]
};

main().catch(console.error);

async function main() {
  const auth = await authenticate();
  const gmail = google.gmail({ version: 'v1', auth });
  const drive = google.drive({ version: 'v3', auth });

  const message = await getLatestMessage(gmail);
  const data = extractSubmissionData(message);
  if (!data) return console.error('⚠️ No valid submission found.');

  translateFields(data);

  const pdfBuffer = await generateFilledPdf(data);
  const folderId = await getOrCreateClientFolder(drive, data.firstName, data.lastName);
  const file = await uploadToDrive(drive, pdfBuffer, `EX15 - ${data.firstName} ${data.lastName}.pdf`, folderId);

  console.log(`✅ File uploaded: ${file.webViewLink}`);
}

// 🔎 Gmail: get most recent message with label
async function getLatestMessage(gmail) {
  const labels = await gmail.users.labels.list({ userId: 'me' });
  const labelId = labels.data.labels.find(label => label.name === LABEL_NAME)?.id;
  if (!labelId) throw new Error(`Label "${LABEL_NAME}" not found`);

  const res = await gmail.users.messages.list({
    userId: 'me',
    labelIds: [labelId],
    maxResults: 1
  });

  const msgId = res.data.messages?.[0]?.id;
  if (!msgId) return null;

  const msg = await gmail.users.messages.get({ userId: 'me', id: msgId });
  const body = Buffer.from(msg.data.payload.parts?.[0]?.body?.data || '', 'base64').toString('utf-8');

  // ✅ Mark email as read
  await gmail.users.messages.modify({
    userId: 'me',
    id: msgId,
    requestBody: { removeLabelIds: ['UNREAD'] }
  });

  return body;
}

function extractSubmissionData(body) {
  const fields = {
    "First name/s": "firstName",
    "Last name": "lastName",
    "Email": "email",
    "Phone": "phone",
    "Birth date": "birthDate",
    "Country": "country",
    "Passport number": "passport",
    "Gender": "gender",
    "Place of Birth (City)": "placeOfBirth",
    "Civil status": "civilStatus",
    "Nationality": "nationality",
    "Name of the mother": "motherName",
    "Name of the father": "fatherName",
    "Reason for applying for NIE": "reason",
    "Explain shortly the reason chosen above": "reasonExplanation",
    "Multi-line address": "address"
  };

  const parsed = {};
  const lines = body.split('\n');
  for (const line of lines) {
    for (const [label, key] of Object.entries(fields)) {
      if (line.includes(`${label} :`)) {
        parsed[key] = line.split(`${label} :`)[1]?.trim();
      }
    }
  }

  // 🏗️ Address Parsing: Abeelstraat 23 4814 HA Breda NL
  if (parsed.address) {
    const addressParts = parsed.address.split(/\s+/);
    parsed.addressStreet = addressParts[0];
    parsed.addressNumber = addressParts[1];
    parsed.zip = `${addressParts[2]} ${addressParts[3]}`;
    parsed.city = addressParts[4];
  }

  return parsed;
}

function translateFields(data) {
  const lower = str => str?.toLowerCase()?.trim();

  data.nationality = translations.nationalities[lower(data.nationality)] || data.nationality;
  data.country = translations.countries[lower(data.country)] || data.country;
  data.reasonExplanation = translations.reasons[lower(data.reasonExplanation)] || data.reasonExplanation;
}

async function generateFilledPdf(data) {
  const pdfBytes = fs.readFileSync(TEMPLATE_PATH);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const form = pdfDoc.getForm();

  const birth = new Date(data.birthDate);
  const today = new Date();
  const day = today.getDate().toString().padStart(2, '0');
  const month = translations.months[today.getMonth()];

  const fields = [
    { id: 'Nombre', value: data.firstName },
    { id: '1er Apellido', value: data.lastName },
    { id: 'NombreRazón Social', value: `${data.firstName} ${data.lastName}` },
    { id: 'Nombre y apellidos del titular', value: `${data.firstName} ${data.lastName}` },
    { id: 'email', value: data.email },
    { id: 'email_notificacion', value: data.email },
    { id: 'Teléfono móvil', value: data.phone },
    { id: 'Teléfono notificación', value: data.phone },
    { id: 'Dia_Nacimiento', value: birth.getDate().toString().padStart(2, '0') },
    { id: 'Mes_Nacimiento', value: (birth.getMonth() + 1).toString().padStart(2, '0') },
    { id: 'Año_Nacimiento', value: birth.getFullYear().toString() },
    { id: 'Pais', value: data.country },
    { id: 'PASAPORTE', value: data.passport },
    { id: 'DNINIEPAS_Notificacio', value: data.passport },
    { id: 'Lugar', value: data.placeOfBirth },
    { id: 'Nacionalidad', value: data.nationality },
    { id: 'Nombre de la madre', value: data.motherName },
    { id: 'Nombre del padre', value: data.fatherName },
    { id: 'Motivos', value: data.reasonExplanation },
    { id: 'Domicilio en España', value: data.addressStreet },
    { id: 'Domicilio en España notificación', value: data.addressStreet },
    { id: 'Numero', value: data.addressNumber },
    { id: 'Numero_notificacion', value: data.addressNumber },
    { id: 'Localidad', value: data.city },
    { id: 'Provincia', value: data.city },
    { id: 'Localidad notificación', value: data.city },
    { id: 'N Piso_Notificacion', value: data.city },
    { id: 'CP', value: data.zip },
    { id: 'CP notificación', value: data.zip },
    { id: 'Dia_FIrma', value: day },
    { id: 'Mes_Firma', value: month },

    // Checkboxes
    { id: 'Sexo', value: data.gender === 'Female' ? 'X' : '' },

    // Estado Civil checkboxes
    { id: 'Soltero', value: data.civilStatus === 'Single' ? 'X' : '' },
    { id: 'Casado', value: data.civilStatus === 'Married' ? 'X' : '' },
    { id: 'Viudo', value: data.civilStatus === 'Widow' ? 'X' : '' },
    { id: 'Divorciado', value: data.civilStatus === 'Divorced' ? 'X' : '' },
    { id: 'Separado', value: data.civilStatus === 'Separated' ? 'X' : '' },

    // Reason
    { id: 'Por intereses económicos', value: data.reason === 'Economical' ? 'X' : '' },
    { id: 'Por intereses profesioales', value: data.reason === 'Professional' ? 'X' : '' },
    { id: 'Por intereses sociales', value: data.reason === 'Social' ? 'X' : '' }
  ];

  for (const { id, value } of fields) {
    const field = form.getFieldMaybe?.(id);
    if (!field) continue;

    if (field.constructor.name === 'PDFTextField') {
      field.setText(value);
    } else if (field.constructor.name === 'PDFCheckBox') {
      if (value === 'X') field.check();
      else field.uncheck();
    }
  }

  return await pdfDoc.save();
}

async function getOrCreateClientFolder(drive, firstName, lastName) {
  const folderName = `${firstName.trim()} ${lastName.trim()}`;
  const query = `'${PARENT_FOLDER_ID}' in parents and name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;

  const res = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    spaces: 'drive'
  });

  if (res.data.files.length > 0) {
    console.log('📁 Found existing client folder:', folderName);
    return res.data.files[0].id;
  }

  const metadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [PARENT_FOLDER_ID]
  };

  const folder = await drive.files.create({
    requestBody: metadata,
    fields: 'id'
  });

  console.log('📁 Created new client folder:', folderName);
  return folder.data.id;
}

async function uploadToDrive(drive, buffer, filename, folderId) {
  const bufferStream = new stream.PassThrough();
  bufferStream.end(buffer);

  const res = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [folderId]
    },
    media: {
      mimeType: 'application/pdf',
      body: bufferStream
    },
    fields: 'id, webViewLink'
  });

  return res.data;
}
