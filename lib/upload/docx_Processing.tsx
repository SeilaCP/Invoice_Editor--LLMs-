export async function extractDocxText(file: File): Promise<string> {
  try {
    const buffer = await file.arrayBuffer()

    const text = new TextDecoder().decode(buffer)
    return text
  } catch (error) {
    console.error('[v0] Error extracting DOCX text:', error)
    return ''
  }
}

export async function extractPlaceholders(text: string): Promise<string[]> {
  const patterns = [/\{\{(\w+)\}\}/g, /\$\{(\w+)\}/g, /\[(\w+)\]/g]

  const placeholders = new Set<string>()

  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(text)) !== null) {
      placeholders.add(match[1])
    }
  }

  return Array.from(placeholders)
}
