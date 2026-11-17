// Project images arrive at upload size (one was 216 KB) but draw at 15 px. Shrinking them keeps the cached
// tree under the storage limit of one value (256 KB) and saves decoding the full image on every render.
import type { TreeNode } from '../types'

/** 15 px at up to 3x pixel density. */
const THUMB_PX = 48

const thumbs = new Map<string, Promise<string>>()

async function draw(src: string): Promise<string> {
  const image = new Image()
  image.src = src
  await image.decode()
  const { naturalWidth: width, naturalHeight: height } = image
  if (width <= THUMB_PX && height <= THUMB_PX) return src
  const scale = THUMB_PX / Math.max(width, height)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const context = canvas.getContext('2d')
  if (!context) return src
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  const thumb = canvas.toDataURL('image/png')
  return thumb.length < src.length ? thumb : src
}

/** Same source, same answer; an image that cannot be decoded keeps its source. */
function thumbnail(src: string): Promise<string> {
  let cached = thumbs.get(src)
  if (!cached) {
    cached = draw(src).catch(() => src)
    thumbs.set(src, cached)
  }
  return cached
}

/** Swaps every image icon in the tree for its thumbnail, in place. */
export async function shrinkImages(nodes: TreeNode[]): Promise<void> {
  const pending: Promise<void>[] = []
  const walk = (list: TreeNode[]): void => {
    for (const node of list) {
      const icon = node.kind === 'workspace' ? node.icon : undefined
      if (icon?.type === 'image') pending.push(thumbnail(icon.src).then((src) => void (icon.src = src)))
      walk(node.children)
    }
  }
  walk(nodes)
  await Promise.all(pending)
}
