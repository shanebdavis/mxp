const ArtStandardLib = require('art-standard-lib');
import { Simplify } from 'type-fest';

type NotPresent = null | undefined;

/**
 * eq is a function that returns true if two values are equal using deep equality
 * @param a - The first value to compare
 * @param b - The second value to compare
 * @returns true if the values are equal
 */
export const eq = ArtStandardLib.eq as (a: any, b: any) => boolean

/**
 * neq is a function that returns true if two values are not equal using deep equality
 * @param a - The first value to compare
 * @param b - The second value to compare
 * @returns true if the values are not equal
 */
export const neq = ArtStandardLib.neq as (a: any, b: any) => boolean

/***************************************************************
 * Constants
 **************************************************************/
export const secondsPer = {
  ms: 0.001,
  s: 1,
  m: 60,
  h: 3600,
  d: 86400,
  w: 604800,
  mo: 2629746,
  y: 31556952,
  millisecond: 0.001,
  second: 1,
  minute: 60,
  hour: 3600,
  day: 86400,
  month: 2629746,
  year: 31556952,
  week: 604800,
};

type TimeoutFunction = (ms: number) => Promise<void>;
export const timeout = ArtStandardLib.timeout as TimeoutFunction;

/***************************************************************
 * Terminal Colors
 **************************************************************/
// a bunch of functions named after the terminal colors that take in a string and return a string
/*
# Style map codes copied from https://github.com/chalk/chalk
styleMap =
  # style
  reset: 0 0
  bold: 1 22
  dim: 2 22
  italic: 3 23
  underline: 4 24
  inverse: 7 27
  hidden: 8 28
  strikethrough: 9 29

  # front color
  black: 30 39
  red: 31 39
  green: 32 39
  yellow: 33 39
  blue: 34 39
  magenta: 35 39
  cyan: 36 39
  white: 37 39
  grey: 90 39
  redBright: 91 39
  greenBright: 92 39
  yellowBright: 93 39
  blueBright: 94 39
  magentaBright: 95 39
  cyanBright: 96 39
  whiteBright: 97 39

  # back color
  bgBlack: 40 49
  bgRed: 41 49
  bgGreen: 42 49
  bgYellow: 43 49
  bgBlue: 44 49
  bgMagenta: 45 49
  bgCyan: 46 49
  bgWhite: 47 49
  bgGrey: 100 49
  bgRedBright: 101 49
  bgGreenBright: 102 49
  bgYellowBright: 103 49
  bgBlueBright: 104 49
  bgMagentaBright: 105 49
  bgCyanBright: 106 49
  bgWhiteBright: 107 49

*/

type TerminalColorFunction = (s: string) => string;
type TerminalColorFgNames =
  | 'black'
  | 'red'
  | 'green'
  | 'yellow'
  | 'blue'
  | 'magenta'
  | 'cyan'
  | 'white'
  | 'grey'
  | 'redBright'
  | 'greenBright'
  | 'yellowBright'
  | 'blueBright'
  | 'magentaBright'
  | 'cyanBright'
  | 'whiteBright';
type TerminalColorBgNames =
  | 'bgBlack'
  | 'bgRed'
  | 'bgGreen'
  | 'bgYellow'
  | 'bgBlue'
  | 'bgMagenta'
  | 'bgCyan'
  | 'bgWhite'
  | 'bgGrey'
  | 'bgRedBright'
  | 'bgGreenBright'
  | 'bgYellowBright'
  | 'bgBlueBright'
  | 'bgMagentaBright'
  | 'bgCyanBright'
  | 'bgWhiteBright';
type TerminalColorSpecialNames = 'bold' | 'dim' | 'italic' | 'underline' | 'inverse' | 'hidden' | 'strikethrough';
type AllTerminalColorNames = TerminalColorFgNames | TerminalColorBgNames | TerminalColorSpecialNames;
export const TerminalColors = ArtStandardLib.TerminalColors as Record<AllTerminalColorNames, TerminalColorFunction> & {
  reset: () => string;
};

/***************************************************************
 * Promise
 **************************************************************/
// Promise plus deepAll which takes in any array or object structure, nested, resolves all promises, and returns the result in the same structure
type DeeplyStripPromises<T> = T extends PromiseLike<infer U>
  ? DeeplyStripPromises<U> // recursively stripping promises
  : T extends (infer U)[]
  ? DeeplyStripPromises<U>[] // handle arrays
  : T extends PlainObject
  ? { [K in keyof T]: DeeplyStripPromises<T[K]> } // handle objects
  : T; // handle non-arrays and non-objects

export const Promise = ArtStandardLib.Promise as typeof ArtStandardLib.Promise & {
  deepAll: <T>(value: T) => Promise<DeeplyStripPromises<T>>;
};

/***************************************************************
 * Numbers
 **************************************************************/
export const min = Math.min;
export const max = Math.max;
export const bound = (gte: number, value: number, lte: number) => ArtStandardLib.bound(gte, value, lte);

/***************************************************************
 * Strings
 **************************************************************/
export const randomString = (length?: number): string => ArtStandardLib.randomString(length);
export const commaize = (value: number): string => ArtStandardLib.commaize(value);
export const capitalize = (value: string): string => ArtStandardLib.capitalize(value);

interface PluralizeFunction {
  (singularName: string, count?: number): string;
  (count: number, singularName: string): string;
  (count: number, singularName: string, customPluralForm: string): string;
}

export const pluralize: PluralizeFunction = ArtStandardLib.pluralize;

type WFunction = (...args: string[]) => string[];

/**
 * w takes one or more strings and splits them into words and then returns an array of all words found
 *
 * @param args - one or more strings to split into words
 * @returns an array of all words found
 */
export const w: WFunction = ArtStandardLib.w;

/***************************************************************
 * Date and Time
 **************************************************************/
export const formatDate = (date?: Date | number | string, format?: string) => {
  return ArtStandardLib.formatDate(date, format);
};

export const toSeconds = (date?: Date | number | string): number => ArtStandardLib.toSeconds(date);
export const toDate = (date?: Date | number | string): Date => ArtStandardLib.toDate(date);

export const currentSecond = (): number => ArtStandardLib.currentSecond();

/***************************************************************
 * Case
 **************************************************************/
export const lowerCamelCase = (value: string, delimiter?: string): string =>
  ArtStandardLib.lowerCamelCase(value, delimiter);
export const upperCamelCase = (value: string, delimiter?: string): string =>
  ArtStandardLib.upperCamelCase(value, delimiter);
export const snakeCase = (value: string, delimiter?: string): string => ArtStandardLib.snakeCase(value, delimiter);
export const upperSnakeCase = (value: string, delimiter?: string): string =>
  ArtStandardLib.upperSnakeCase(value, delimiter);
export const dashCase = (value: string, delimiter?: string): string => ArtStandardLib.dashCase(value, delimiter);
export const codeWords = (value: string): string[] => ArtStandardLib.codeWords(value);

/***************************************************************
 * Types
 **************************************************************/
export type PlainObject<T = any> = Record<string, T>;
export type NestedArray<T> = T | NestedArray<T>[];
export type SparseItem<T> = T | NotPresent;
export type SparseArray<T> = SparseItem<T>[];
export type SparseNestedArray<T> = NestedArray<SparseItem<T>>;
export type SparseNestedArrayOrSingleton<T> = SparseNestedArray<T> | T;

/***************************************************************
 * Type Helpers
 **************************************************************/
export const isPlainObject = (value: any): value is PlainObject => ArtStandardLib.isPlainObject(value);
export const isString = (value: any): value is string => typeof value === 'string';
export const isFunction = (value: any): value is Function => typeof value === 'function';
export const isNumber = (value: any): value is number => typeof value === 'number';
export const isBoolean = (value: any): value is boolean => typeof value === 'boolean';
export const isDate = (value: any): value is Date => value instanceof Date;
export const isArray = (value: any): value is any[] => Array.isArray(value);
export const present = <T>(value: T): value is NonNullable<T> => ArtStandardLib.present(value); // value is not null or undefined or empty string

export const isPresentString = (value: any): value is string => typeof value === 'string' && present(value);

/***************************************************************
 * Collection Helpers
 **************************************************************/
type MergeIntersection<T extends any[]> = T extends [infer Head, ...infer Tail] // Destructure the tuple into head and tail
  ? Head extends PlainObject // Check if the head is a PlainObject
  ? Tail extends any[] // Check if the tail is a tuple
  ? Head & MergeIntersection<Tail> // Recursively intersect the head with the result of the tail
  : Head // If the tail is not an array, return the head (base case)
  : unknown // If the head is not a PlainObject, return unknown (can be adjusted)
  : unknown; // Base case for empty tuple

export const merge = <T extends (PlainObject | NotPresent)[]>(...args: T): MergeIntersection<T> => {
  return ArtStandardLib.merge(...args) as MergeIntersection<T>;
};

export const mergeInto = <T extends (PlainObject | NotPresent)[]>(...args: T): MergeIntersection<T> => {
  return ArtStandardLib.mergeInto(...args) as MergeIntersection<T>;
};

export const flatten = <T>(arr: NestedArray<T>): T[] => ArtStandardLib.flatten(arr);
export const compact = <T>(arr: SparseArray<T>): T[] => ArtStandardLib.compact(arr);

type CompactFlattenFunction = {
  (a: null): null;
  (a?: undefined): undefined;
  <T>(arr: SparseNestedArrayOrSingleton<T>): T[];
};
export const compactFlatten: CompactFlattenFunction = ArtStandardLib.compactFlatten;

export const objectKeyCount = (obj: PlainObject | NotPresent): number => ArtStandardLib.objectKeyCount(obj);

/**
 * Returns true if the object has keys - optimized for performance - use this instead of Object.keys(obj).length > 0
 * @param obj - The object to check
 * @returns true if the object has keys
 */
export const objectHasKeys = (obj: PlainObject | NotPresent): boolean => ArtStandardLib.objectHasKeys(obj);

type PeekFunctionType = {
  <T>(arr: undefined | null | readonly []): undefined;
  <T>(arr: readonly [...any[], T]): T;
  <T>(arr: readonly T[]): T | undefined;
  (arr: string): string | undefined;
};

export const peek = ArtStandardLib.peek as PeekFunctionType;

export const asPlainObject = (value: any): PlainObject => (ArtStandardLib.isPlainObject(value) ? value : {});
export const asNumber = (value: any): number => (ArtStandardLib.isNumber(value) ? value : 0);

type ObjectWithoutFunction = <T extends PlainObject, K extends string[]>(
  obj: T,
  ...keys: [...K]
) => Simplify<Omit<T, K[number]>>;
export const objectWithout = ArtStandardLib.objectWithout as ObjectWithoutFunction;

/***************************************************************
 * Comprehensions
 **************************************************************/

type ArrayWithFunction<InType, OutType> = (value: InType, key: number) => OutType;
type ObjectWithFunction<InType, OutType> = (value: InType, key: string) => OutType;

interface ArrayIterationOptionsBase<InType> {
  when?: (value: InType, key: number) => boolean;
  into?: InType[];
}

interface ArrayIterationOptionsWithCustomWith<InType, OutType> extends ArrayIterationOptionsBase<InType> {
  with: ArrayWithFunction<InType, OutType>;
}

interface ObjectIterationOptionsBase<InType> {
  when?: (value: InType, key: string) => boolean;
  withKey?: (value: InType, key: string) => string | undefined | null;
  into?: PlainObject<InType>;
}

interface ObjectIterationOptionsWithCustomWith<InType, OutType> extends ObjectIterationOptionsBase<InType> {
  with: ObjectWithFunction<InType, OutType>;
}

type ArrayFunctionWithObjectInput = {
  <InType>(input: PlainObject<InType> | NotPresent): InType[];
  <InType, OutType>(input: PlainObject<InType> | NotPresent, withFn: ObjectWithFunction<InType, OutType>): OutType[];
  <InType>(input: PlainObject<InType> | NotPresent, options: ObjectIterationOptionsBase<InType>): InType[];
  <InType, OutType>(
    input: PlainObject<InType> | NotPresent,
    options: ObjectIterationOptionsWithCustomWith<InType, OutType>
  ): OutType[];
};

type ArrayFunctionWithArrayInput = {
  <InType>(input: InType[] | NotPresent): InType[];
  <InType, OutType>(input: InType[] | NotPresent, withFn: ArrayWithFunction<InType, OutType>): OutType[];
  <InType>(input: InType[] | NotPresent, options: ArrayIterationOptionsBase<InType>): InType[];
  <InType, OutType>(
    input: InType[] | NotPresent,
    options: ArrayIterationOptionsWithCustomWith<InType, OutType>
  ): OutType[];
};

type ArrayFunction = {
  (input: NotPresent, _ignored: any): [];
} & ArrayFunctionWithArrayInput &
  ArrayFunctionWithObjectInput;

export const array = ArtStandardLib.array as ArrayFunction;

type ObjectFunction = {
  (input: NotPresent, _ignored: any): PlainObject<any>;
  <InType>(input: InType[] | NotPresent): PlainObject<InType>;
  <InType>(input: PlainObject<InType> | NotPresent): PlainObject<InType>;
  <InType, OutType>(input: InType[] | NotPresent, withFn: ArrayWithFunction<InType, OutType>): PlainObject<OutType>;
  <InType, OutType>(
    input: PlainObject<InType> | NotPresent,
    withFn: ObjectWithFunction<InType, OutType>
  ): PlainObject<OutType>;
  <InType>(input: InType[] | NotPresent, options: ObjectIterationOptionsBase<InType>): PlainObject<InType>;
  <InType>(input: PlainObject<InType> | NotPresent, options: ObjectIterationOptionsBase<InType>): PlainObject<InType>;
  <InType, OutType>(
    input: InType[] | NotPresent,
    options: ObjectIterationOptionsWithCustomWith<InType, OutType>
  ): PlainObject<OutType>;
  <InType, OutType>(
    input: PlainObject<InType> | NotPresent,
    options: ObjectIterationOptionsWithCustomWith<InType, OutType>
  ): PlainObject<OutType>;
};

export const object = ArtStandardLib.object as ObjectFunction;

type FindFunction = {
  (input: NotPresent, _ignored: any): undefined;
  <InType>(input: InType[] | NotPresent): InType | undefined;
  <InType>(input: PlainObject<InType> | NotPresent): InType | undefined;
  <InType, OutType>(input: InType[] | NotPresent, withFn: ArrayWithFunction<InType, OutType>): OutType | undefined;
  <InType, OutType>(input: PlainObject<InType> | NotPresent, withFn: ObjectWithFunction<InType, OutType>):
    | OutType
    | undefined;
  <InType>(input: InType[] | NotPresent, options: ArrayIterationOptionsBase<InType>): InType | undefined;
  <InType>(input: PlainObject<InType> | NotPresent, options: ArrayIterationOptionsBase<InType>): InType | undefined;
  <InType, OutType>(input: InType[] | NotPresent, options: ArrayIterationOptionsWithCustomWith<InType, OutType>):
    | OutType
    | undefined;
  <InType, OutType>(
    input: PlainObject<InType> | NotPresent,
    options: ArrayIterationOptionsWithCustomWith<InType, OutType>
  ): OutType | undefined;
};

export const find = ArtStandardLib.find as FindFunction;

type ArrayReduceFunction<InType, OutType> = (
  previousValue: OutType & InType,
  currentValue: InType,
  key: number
) => OutType;
type ObjectReduceFunction<InType, OutType> = (
  previousValue: OutType & InType,
  currentValue: InType,
  key: string
) => OutType;

interface ArrayIterationOptionsForReduce<InType, OutType> extends ArrayIterationOptionsBase<InType> {
  with: ArrayReduceFunction<InType, OutType>;
  inject?: OutType & InType;
}

type ReduceFunctionOverloads = {
  <InType>(input: InType[]): InType;
  <InType>(input: PlainObject<InType>): InType;
  <InType, OutType>(
    input: InType[],
    reduceFn: ArrayReduceFunction<InType, OutType>,
    inject?: OutType & InType
  ): OutType;
  <InType, OutType>(
    input: PlainObject<InType>,
    reduceFn: ObjectReduceFunction<InType, OutType>,
    inject?: OutType & InType
  ): OutType;
  <InType, OutType>(input: InType[], options: ArrayIterationOptionsForReduce<InType, OutType>): OutType;
  <InType, OutType>(input: PlainObject<InType>, options: ArrayIterationOptionsForReduce<InType, OutType>): OutType;
};

export const reduce = ArtStandardLib.reduce as ReduceFunctionOverloads;

/***************************************************************
 * Logging
 **************************************************************/
export const log = <T extends any[]>(...args: T): T extends [...infer Rest, infer Last] ? Last : never => {
  ArtStandardLib.log.withOptions({ color: true }, args.length === 1 ? args[0] : args);
  return args[args.length - 1] as T extends [...infer Rest, infer Last] ? Last : never;
};

log.error = <T extends any[]>(...args: T): T extends [...infer Rest, infer Last] ? Last : never => {
  ArtStandardLib.log.withOptions({ isError: true, color: true }, args.length === 1 ? args[0] : args);
  return args[args.length - 1] as T extends [...infer Rest, infer Last] ? Last : never;
};

log.warn = <T extends any[]>(...args: T): T extends [...infer Rest, infer Last] ? Last : never => {
  ArtStandardLib.log.withOptions({ isWarning: true, color: true }, args.length === 1 ? args[0] : args);
  return args[args.length - 1] as T extends [...infer Rest, infer Last] ? Last : never;
};

log.unquoted = <T extends any[]>(...args: T): T extends [...infer Rest, infer Last] ? Last : never => {
  ArtStandardLib.log.withOptions({ unquoted: true, color: true }, args.length === 1 ? args[0] : args);
  return args[args.length - 1] as T extends [...infer Rest, infer Last] ? Last : never;
};

export const formattedInspect = (...args: any[]): string => ArtStandardLib.formattedInspect(...args);

/***************************************************************
 * ArtStandardLib for TypeScript should have.. Type helpers!
 **************************************************************/
export type ArbitraryArrayNesting<T> = (T | ArbitraryArrayNesting<T>)[]
export type ArbitraryArrayNestingWithNullAndUndefined<T> = (T | null | undefined | ArbitraryArrayNestingWithNullAndUndefined<T>)[]

const isNull = (value: any): boolean => value === null
const isNotNull = (value: any): boolean => !isNull(value)

export const deepStripNulls = (data: any): any =>
  isArray(data) ? array(data, { when: isNotNull, with: deepStripNulls })
    : isPlainObject(data) ? object(data, { when: isNotNull, with: deepStripNulls })
      : data

const isNullish = (value: any): boolean => value == null
const isNotNullish = (value: any): boolean => !isNullish(value)

export const deepStripNullish = (data: any): any =>
  isArray(data) ? array(data, { when: isNotNullish, with: deepStripNullish })
    : isPlainObject(data) ? object(data, { when: isNotNullish, with: deepStripNullish })
      : data
