import util from 'util'

export const log = <T>(...args: [...unknown[], T]): T => {
  console.log(args.map(arg =>
    typeof arg === 'string' ? arg :
      util.inspect(arg, { depth: null, colors: true })).join(', '))
  return args[args.length - 1] as T
}
