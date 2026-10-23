export type Align = 'left' | 'center' | 'right'

export type FontKey = 'sans' | 'serif' | 'kai' | 'mono' | 'display'

export type RatioKey = '1:1' | '3:4' | '16:9' | '4:5' | '9:16' | 'custom'

export interface RatioPreset {
  key: RatioKey
  label: string
  hint: string
  width: number
  height: number
}

export interface TextStyle {
  /** 标题字号（逻辑像素，基于 1080 宽度基准） */
  titleSize: number
  bodySize: number
  titleWeight: number
  bodyWeight: number
  /** 行高倍数 */
  lineHeight: number
  /** 字间距，单位 px */
  letterSpacing: number
  align: Align
  fontTitle: FontKey
  fontBody: FontKey
  ink: string
  inkSoft: string
  accent: string
  bg: string
}

export interface Content {
  eyebrow: string
  title: string
  body: string
  signature: string
  footer: string
}

export interface Deco {
  icon: IconName
  shape: ShapeName
  divider: DividerName
  corner: CornerName
  showIndex: boolean
  showGrain: boolean
}

export type IconName =
  | 'none'
  | 'sparkles'
  | 'flame'
  | 'zap'
  | 'star'
  | 'bookmark'
  | 'code'
  | 'quote'
  | 'trend'
  | 'hash'
  | 'layers'
  | 'check'

export type ShapeName = 'none' | 'circle' | 'blob' | 'grid' | 'dots' | 'arc' | 'triangle' | 'bars'
export type DividerName = 'none' | 'line' | 'double' | 'dashed' | 'dots' | 'arrow'
export type CornerName = 'none' | 'brackets' | 'tag' | 'index' | 'mono'

export interface ImageLayer {
  src: string
  fit: 'cover' | 'contain'
  opacity: number
  /** 在图上方叠加的主题色，0 表示不叠色 */
  tint: number
  blur: number
  offsetX: number
  offsetY: number
  scale: number
  rounded: boolean
}

export interface Doc {
  templateId: string
  ratioKey: RatioKey
  width: number
  height: number
  content: Content
  style: TextStyle
  deco: Deco
  image: ImageLayer | null
  /** 透明背景（导出 PNG 保留 alpha） */
  transparent: boolean
  /** 自动排版：标题过长时自动缩放、正文过长时自动分栏 */
  autoFit: boolean
  /** 用户手动缩放整体字号（1 = 模板默认） */
  scale: number
}

export interface TemplateDef {
  id: string
  name: string
  tagline: string
  /** 缩略图小标签 */
  tag: string
  sample: Content
  style: TextStyle
  deco: Deco
  /** 标题最多行数（自动排版时使用） */
  titleMaxLines: number
  /** 正文建议字数上限 */
  bodyHint: number
  /** 该模板适合的比例 */
  bestRatio: RatioKey
  /** 该模板原生绘制了哪些装饰（未声明的由通用装饰层补齐，保证控件真实生效） */
  handles?: Partial<Record<'icon' | 'shape' | 'divider' | 'corner', boolean>>
  /** 该模板独有绘制逻辑 */
  render: TemplateRender
}

export interface RenderCtx {
  ctx: CanvasRenderingContext2D
  W: number
  H: number
  doc: Doc
  image: HTMLImageElement | null
  warnings: LayoutWarning[]
}

export interface LayoutWarning {
  kind: 'title' | 'body' | 'image' | 'font'
  text: string
}

export type TemplateRender = (r: RenderCtx) => void
