import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://sjrfppeisxmglrozufoy.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseAnonKey) {
  console.warn('VITE_SUPABASE_ANON_KEY is not set. Please add it to your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * Upload a PDF file to Supabase Storage
 * @param file The file to upload
 * @param storageKey The key/path where the file should be stored
 * @returns The public URL of the uploaded file
 */
export async function uploadPdfToStorage(file: File, storageKey: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('pdfs')
    .upload(storageKey, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (error) {
    throw new Error(`Failed to upload file: ${error.message}`)
  }

  return data.path
}



