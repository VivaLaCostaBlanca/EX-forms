const fs = require('fs');
const { PDFDocument } = require('pdf-lib');

async function fillEX15PDF() {
  const data = {
    firstName: 'Malinka Jose',
    lastName: 'Savenije',
    email: 'malinkasavenije@gmail.com',
    phone: '+31 6 41992607',
    birthDate: '1970-09-15',
    country: 'Nederland',
    passport: 'NP8KPJ1C1',
    gender: 'Female',
    placeOfBirth: 'Vlaardingen',
    civilStatus: 'Divorced',
    nationality: 'Nederlandse',
    motherName: 'Nelly Markestein',
    fatherName: 'Franciscus Johannes Maria Savenije',
    reason: 'Economical',
    reasonExplanation: 'een huis kopen',
    address1: 'Abeelstraat 23',
    address2: '',
    city: 'Breda',
    zip: '4814 HA'
  };

  const birth = new Date(data.birthDate);

  // 1. Load PDF
  const formBytes = fs.readFileSync('ex15-form.pdf');
  const pdfDoc = await PDFDocument.load(formBytes);
  const form = pdfDoc.getForm();

  // 2. Define your field mappings
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
    { id: 'Domicilio en España', value: `${data.address1} ${data.address2}` },
    { id: 'Domicilio en España notificación', value: `${data.address1} ${data.address2}` },
    { id: 'Localidad', value: data.city },
    { id: 'Provincia', value: data.city },
    { id: 'Localidad notificación', value: data.city },
    { id: 'N Piso_Notificacion', value: data.city },
    { id: 'CP', value: data.zip },
    { id: 'CP notificación', value: data.zip },
    { id: 'Sexo', value: data.gender === 'Female' ? 'X' : '' }, // Adjusted to prefer Female
    { id: 'Estado Civil', value: 'X' },
    { id: 'Por intereses económicos', value: data.reason === 'Economical' ? 'X' : '' },
    { id: 'Por intereses profesioales', value: data.reason === 'Professional' ? 'X' : '' },
    { id: 'Por intereses sociales', value: data.reason === 'Social' ? 'X' : '' }
  ];

  // 3. Fill in the form
  fields.forEach(({ id, value }) => {
    const field = form.getFieldMaybe?.(id) || form.getField(id);
    if (!field) {
      console.warn(`⚠️ Field not found: ${id}`);
      return;
    }

    try {
      if (field.constructor.name === 'PDFTextField') {
        field.setText(value);
      } else if (field.constructor.name === 'PDFCheckBox') {
        value === 'X' ? field.check() : field.uncheck();
      }
    } catch (err) {
      console.error(`❌ Error filling ${id}:`, err.message);
    }
  });

  // 4. Save and export
  const pdfBytes = await pdfDoc.save();
  const outputFile = `EX15 - ${data.firstName} ${data.lastName}.pdf`;
  fs.writeFileSync(outputFile, pdfBytes);
  console.log(`✅ PDF generated: ${outputFile}`);
}

fillEX15PDF();
