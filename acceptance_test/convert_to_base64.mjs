import fs from 'fs';
import path from 'path';

// The name of your downloaded template
const fileName = '6x9-postcard-template.pdf';

try {
  const filePath = path.resolve(process.cwd(), fileName);
  
  // Read the file into a buffer
  const fileBuffer = fs.readFileSync(filePath);
  
  // Convert buffer to Base64 string
  const base64String = fileBuffer.toString('base64');
  
  // Create the full Data URI string
  const dataUri = `data:application/pdf;base64,${base64String}`;
  
  console.log("--- COPY THE STRING BELOW ---");
  console.log(dataUri);
  console.log("--- END OF STRING ---");
} catch (error) {
  console.error("Error: Could not find or read the file. Ensure 6x9-postcard-template.pdf is in this folder.");
}