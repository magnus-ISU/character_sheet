// This module provides an enhanced JSON parsing function that handles trailing commas and unquoted keys/values.
export { parseFlexibleJSON, getKeyLineNumbers };

// Enhanced JSON parsing function that handles trailing commas and unquoted keys/values
function parseFlexibleJSON(jsonString: string): object {
	const normalizedJSON = parseUnquotedJSON(jsonString.replaceAll('\\', '\\\\'));
	try {
		let obj = JSON.parse(normalizedJSON);
		return obj;
	} catch (error: any) {
		let errorMessage = `JSON parsing failed: ${error.message}\nNormalized JSON:\n${normalizedJSON}\nOriginal:\n${jsonString}`;
		console.log(errorMessage);
		throw new Error(errorMessage);
	}
}

interface ParseResult {
	success: boolean;
	data?: any;
	error?: string;
}

interface KeyLineInfo {
	[key: string]: number;
}

class UnquotedJSONParser {
	private input: string;
	private pos: number;
	private keyLineNumbers: KeyLineInfo;

	constructor(input: string) {
		this.input = this.removeTrailingCommas(input);
		this.pos = 0;
		this.keyLineNumbers = {};
	}

	private removeTrailingCommas(str: string): string {
		// Remove trailing commas before closing brackets/braces
		let removed = str.replace(/,(\s*[}\]])/g, '$1');
		return removed;
	}

	private getCurrentLineNumber(): number {
		let lineNumber = 0;
		for (let i = 0; i < this.pos; i++) {
			if (this.input[i] === '\n') {
				lineNumber++;
			}
		}
		return lineNumber;
	}

	private skipWhitespace(): void {
		while (this.pos < this.input.length && /[\s]/.test(this.input[this.pos])) {
			this.pos++;
		}
	}

	private peek(): string {
		return this.input[this.pos] || '';
	}

	private advance(): string {
		return this.input[this.pos++] || '';
	}

	private parseString(): string {
		if (this.peek() === '"') {
			// Already quoted string
			this.advance(); // consume opening quote
			let result = '';
			while (this.pos < this.input.length && this.peek() !== '"') {
				if (this.peek() === '\\') {
					this.advance();
					const escaped = this.advance();
					switch (escaped) {
						case 'n':
							result += '\n';
							break;
						case 't':
							result += '\t';
							break;
						case 'r':
							result += '\r';
							break;
						case '\\':
							result += '\\';
							break;
						case '"':
							result += '"';
							break;
						default:
							result += escaped;
							break;
					}
				} else {
					result += this.advance();
				}
			}
			this.advance(); // consume closing quote
			return result;
		} else {
			// Unquoted string - read until delimiter
			let result = '';
			while (this.pos < this.input.length) {
				const char = this.peek();
				if (char === ',' || char === '}' || char === ']' || char === ':') {
					break;
				}
				result += this.advance();
			}
			return result.trim();
		}
	}

	private parseNumber(): number {
		let result = '';
		if (this.peek() === '-') {
			result += this.advance();
		}
		while (this.pos < this.input.length && /[\d.]/.test(this.peek())) {
			result += this.advance();
		}
		return parseFloat(result);
	}

	private parseValue(): any {
		this.skipWhitespace();

		const char = this.peek();

		if (char === '{') {
			return this.parseObject();
		} else if (char === '[') {
			return this.parseArray();
		} else if (char === '"') {
			return this.parseString();
		} else if (char === 't' && this.input.substr(this.pos, 4) === 'true') {
			this.pos += 4;
			return true;
		} else if (char === 'f' && this.input.substr(this.pos, 5) === 'false') {
			this.pos += 5;
			return false;
		} else if (char === 'n' && this.input.substr(this.pos, 4) === 'null') {
			this.pos += 4;
			return null;
		} else if (char === '-' || /\d/.test(char)) {
			// Check if it's a pure number
			const startPos = this.pos;
			const num = this.parseNumber();

			// Check if we consumed the entire token (no non-numeric characters)
			this.skipWhitespace();
			const nextChar = this.peek();
			const isEndOfValue =
				nextChar === ',' ||
				nextChar === '}' ||
				nextChar === ']' ||
				nextChar === '' ||
				/\s/.test(nextChar);

			if (isEndOfValue && !isNaN(num)) {
				return num;
			} else {
				// Reset position and treat as string
				this.pos = startPos;
				return this.parseString();
			}
		} else {
			// Unquoted string or expression
			return this.parseString();
		}
	}

	private parseObject(): any {
		const obj: any = {};
		this.advance(); // consume '{'

		this.skipWhitespace();

		if (this.peek() === '}') {
			this.advance();
			return obj;
		}

		let keyIndex = 0;

		while (this.pos < this.input.length) {
			this.skipWhitespace();

			// Store the line number before parsing the key
			const keyLineNumber = this.getCurrentLineNumber();

			// Check if we have a key-value pair or just a value
			const savePos = this.pos;
			let hasColon = false;

			// More robust lookahead to find colon
			// We need to be more careful about nested structures and quoted content
			let tempPos = this.pos;
			let parenDepth = 0;
			let braceDepth = 0;
			let bracketDepth = 0;
			let inQuotes = false;
			let foundColon = false;
			let foundTerminator = false;

			// First, let's see what kind of token we're starting with
			this.skipWhitespace();
			const isStartingWithQuote = this.peek() === '"';

			// If we start with a quote, we need to be extra careful
			// Parse the complete quoted string first to see what comes after
			if (isStartingWithQuote) {
				let quotedStringEnd = this.pos + 1; // skip opening quote
				let escapeNext = false;

				while (quotedStringEnd < this.input.length) {
					const char = this.input[quotedStringEnd];
					if (escapeNext) {
						escapeNext = false;
					} else if (char === '\\') {
						escapeNext = true;
					} else if (char === '"') {
						quotedStringEnd++; // include closing quote
						break;
					}
					quotedStringEnd++;
				}

				// Now check what comes after the quoted string
				let afterQuotePos = quotedStringEnd;
				while (afterQuotePos < this.input.length && /\s/.test(this.input[afterQuotePos])) {
					afterQuotePos++;
				}

				// If the next non-whitespace character is a colon, it's a key
				if (afterQuotePos < this.input.length && this.input[afterQuotePos] === ':') {
					hasColon = true;
				}
			} else {
				// For unquoted tokens, use the original lookahead logic
				tempPos = this.pos;
				const lookaheadLimit = 1000;

				while (tempPos < this.input.length && tempPos - this.pos < lookaheadLimit) {
					const char = this.input[tempPos];

					if (char === '"' && (tempPos === 0 || this.input[tempPos - 1] !== '\\')) {
						inQuotes = !inQuotes;
					} else if (!inQuotes) {
						if (char === '(') parenDepth++;
						else if (char === ')') parenDepth--;
						else if (char === '{') braceDepth++;
						else if (char === '}') braceDepth--;
						else if (char === '[') bracketDepth++;
						else if (char === ']') bracketDepth--;
						else if (char === ':' && parenDepth === 0 && braceDepth === 0 && bracketDepth === 0) {
							hasColon = true;
							break;
						} else if (char === ',' && parenDepth === 0 && braceDepth === 0 && bracketDepth === 0) {
							break;
						} else if (char === '}' && parenDepth === 0 && braceDepth === 0 && bracketDepth === 0) {
							break;
						}
					}
					tempPos++;
				}
			}

			let key: string;
			let value: any;

			if (hasColon) {
				// Parse as key-value pair
				key = this.parseString();
				this.keyLineNumbers[key] = keyLineNumber;
				this.skipWhitespace();

				if (this.peek() !== ':') {
					let pos = this.pos;
					let input = this.input;
					throw new Error(
						`Expected ':' after key "${key}" at position ${pos}. ${input.substring(pos - 10, pos)} ... ${input.substring(pos, pos + 20)}`
					);
				}
				this.advance();
				this.skipWhitespace();
				value = this.parseValue();
			} else {
				// Parse as value only, assign numeric key
				key = keyIndex.toString();
				this.keyLineNumbers[key] = keyLineNumber;
				keyIndex++;
				value = this.parseValue();
			}

			obj[key] = value;

			this.skipWhitespace();

			if (this.peek() === '}') {
				this.advance();
				break;
			} else if (this.peek() === ',') {
				this.advance();
				// Skip whitespace after comma
				this.skipWhitespace();
				// Check if we're at the end (trailing comma case)
				if (this.peek() === '}') {
					this.advance();
					break;
				}
			} else {
				throw new Error(
					`Expected ',' or '}' at position ${this.pos}, instead got "${this.peek()}", context ${this.input.substring(this.pos - 10, this.pos + 10)}`
				);
			}
		}

		return obj;
	}

	private parseArray(): any[] {
		const arr: any[] = [];
		this.advance(); // consume '['

		this.skipWhitespace();

		if (this.peek() === ']') {
			this.advance();
			return arr;
		}

		while (this.pos < this.input.length) {
			this.skipWhitespace();

			const value = this.parseValue();
			arr.push(value);

			this.skipWhitespace();

			if (this.peek() === ']') {
				this.advance();
				break;
			} else if (this.peek() === ',') {
				this.advance();
				// Skip whitespace after comma
				this.skipWhitespace();
				// Check if we're at the end (trailing comma case)
				if (this.peek() === ']') {
					this.advance();
					break;
				}
			} else {
				let err = `Expected ',' or ']' at position ${this.pos}, instead got "${this.peek()}", context ${this.input.substring(this.pos - 10, this.pos + 10)}`;
				throw new Error(err);
			}
		}

		return arr;
	}

	public parse(): ParseResult {
		try {
			this.pos = 0;
			this.skipWhitespace();
			const result = this.parseValue();
			return { success: true, data: result };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown parsing error'
			};
		}
	}

	public getKeyLineNumbers(): KeyLineInfo {
		return { ...this.keyLineNumbers };
	}
}

// Helper function to convert parsed object back to quoted JSON string
function toQuotedJSON(obj: any, indent: number = 0): string {
	const spaces = ' '.repeat(indent);
	const nextSpaces = ' '.repeat(indent + 1);

	if (obj === null) return 'null';
	if (typeof obj === 'boolean') return obj.toString();
	if (typeof obj === 'number') return obj.toString();
	if (typeof obj === 'string') return `"${obj.replace(/"/g, '\\"')}"`;

	if (Array.isArray(obj)) {
		if (obj.length === 0) return '[]';
		const items = obj.map((item) => toQuotedJSON(item, indent + 1));
		return `[${items.join(', ')}]`;
	}

	if (typeof obj === 'object') {
		const keys = Object.keys(obj);
		if (keys.length === 0) return '{\n \n}';

		const pairs = keys.map((key) => {
			const value = toQuotedJSON(obj[key], indent + 1);
			return `${nextSpaces}"${key}": ${value}`;
		});

		return `{\n${pairs.join(',\n')}\n${spaces}}`;
	}

	return 'null';
}

// Main parsing function
export function parseUnquotedJSON(input: string): string {
	const parser = new UnquotedJSONParser(input);
	const result = parser.parse();

	if (result.success) {
		const jsonString = toQuotedJSON(result.data);
		return jsonString;
	}
	console.log('Failed to parse', input, result);
	return '';
}

// New function to get line numbers for each key
function getKeyLineNumbers(input: string): KeyLineInfo {
	const parser = new UnquotedJSONParser(input);
	const result = parser.parse();

	if (result.success) {
		return parser.getKeyLineNumbers();
	}

	throw new Error('Failed to parse JSON for line number extraction');
}
