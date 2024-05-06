import * as fs from 'fs'
import { program } from 'commander'
import OpenAI from 'openai'

/**
 * Generate E2E test code from existing codes
 *
 * @example
 * $ yarn ts-node src/scripts/generateE2ETest/main.ts --apiBasePath /api/users --input src/routes/users.ts --output test/users.e2e-spec.ts
 */
program
  .version('1.0.0')
  .option('--apiBasePath <apiBasePath>', 'api base uri (ex. /api/resources)')
  .option(
    '--input <input>',
    'input file path (ex. path/to/exampleResources.ts)',
  )
  .option(
    '--output <output>',
    'output file path (ex. path/to/exampleResources.ts)',
  )
  .option('--debug')
  .parse(process.argv)

const exampleFilePaths = ['test/categories.e2e-spec.ts']

function getFileContent(filePath: string) {
  const data = fs.readFileSync(filePath, 'utf8')
  return data
}

function getPrompt(
  params: Pick<GenerateParams, 'apiBasePath' | 'inputFilePath'>,
) {
  const { apiBasePath, inputFilePath } = params
  const exampleCodes = exampleFilePaths
    .map((filePath: string) => `## ${filePath}\n${getFileContent(filePath)}`)
    .join('\n')
  const inputCode = getFileContent(inputFilePath)
  const prompt = `Please write a E2E test 

# Requirement
- Written in TypeScript
- Use these libraries and packages are already installed
  - supertest
  - jest
- Entry Point Base Path is '${apiBasePath}'
- reset all mocks and delete all fixtures every test

# Example
${exampleCodes}

# Code
${inputCode}

# Output
{ "code": "<Output Code HERE>" }
`
  return prompt
}

type GenerateParams = {
  apiBasePath: string
  inputFilePath: string
  outputFilePath: string
}

async function main(params: GenerateParams) {
  const { apiBasePath, inputFilePath, outputFilePath } = params
  const prompt = getPrompt({ inputFilePath, apiBasePath })
  console.log(prompt)

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
  const completion = await openai.chat.completions.create({
    model: 'gpt-4-turbo-2024-04-09',
    messages: [
      { role: 'system', content: 'Code Generator. JSONで結果を出力' },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
  })
  console.log(completion)
  console.log(completion.choices[0].message.content)
  const content = JSON.parse(completion.choices[0].message.content)
  console.log(content)
  const testCodeStr = content.code || JSON.stringify(content, null, 2)
  console.log(testCodeStr)

  fs.writeFileSync(outputFilePath, testCodeStr)
}

const options = program.opts()

const inputFilePath = options.input
const outputFilePath = options.output
const apiBasePath = options.apiBasePath || '/api'

console.log(`apiBasePath    : ${apiBasePath}`)
console.log(`inputFilePath  : ${inputFilePath}`)
console.log(`outputFilePath : ${outputFilePath}`)

main({ apiBasePath, inputFilePath, outputFilePath })
