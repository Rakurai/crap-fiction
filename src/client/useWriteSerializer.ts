import { useEffect, useRef } from 'react'
import { createWriteSerializer, type WriteSerializer } from './writeSerializer.js'

export function useWriteSerializer(): WriteSerializer {
  const ref = useRef<WriteSerializer | undefined>(undefined)
  ref.current ??= createWriteSerializer()
  const serializer = ref.current

  useEffect(() => {
    serializer.activate()
    return serializer.dispose
  }, [serializer])

  return serializer
}
