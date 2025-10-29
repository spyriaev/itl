export interface DocumentStructureItem {
  id: string
  title: string
  level: number
  pageFrom: number
  pageTo: number | null
  parentId: string | null
  orderIndex: number
  children: DocumentStructureItem[]
}

export interface DocumentStructure {
  documentId: string
  items: DocumentStructureItem[]
}

export interface ChapterInfo {
  id: string
  title: string
  level: number
  pageFrom: number
  pageTo: number | null
}

export type ContextType = 'page' | 'chapter' | 'section' | 'document'
