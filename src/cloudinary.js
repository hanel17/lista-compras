const CLOUD_NAME = 'dn8exsusx'
const UPLOAD_PRESET = 'lista_compras_fotos'

export async function uploadFamilyPhoto(file) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', UPLOAD_PRESET)

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    throw new Error('No se pudo subir la foto')
  }

  const data = await res.json()
  return data.secure_url
}
