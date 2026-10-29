// Demonstration bank normalized by DeepTutor importing.py (identities are
// Python-computed; tests/parity.test.ts re-derives them with the port).
export const example: unknown = [
  {
    "question": "在Python中，哪个集合会自动去除重复值？",
    "question_type": "single_choice",
    "options": {
      "A": "list",
      "B": "set",
      "C": "tuple",
      "D": "str"
    },
    "correct_answer": "B",
    "explanation": "set保存唯一元素，可用于集合运算与去重。",
    "difficulty": "基础",
    "user_answer": "",
    "tags": [
      "集合",
      "Python"
    ],
    "question_id": "import:222e57badbd00b244c4065b2078f201e76b1d0d86ac6213fef99e7a8948b24d0"
  },
  {
    "question": "函数的返回值有什么作用？请用自己的话解释。",
    "question_type": "short_answer",
    "options": {},
    "correct_answer": "把函数内部计算的结果交还给调用者，使程序可以继续使用该结果。",
    "explanation": "返回值与打印不同，调用者可以接收并进一步处理。",
    "difficulty": "理解",
    "user_answer": "",
    "tags": [
      "函数"
    ],
    "question_id": "import:4de3f4211e2832e2fd6a0fa41c5cda40ffaae717871333358c037041ba7a862e"
  },
  {
    "question": "下列哪些操作会改变原列表？",
    "question_type": "multi_choice",
    "options": {
      "A": "append",
      "B": "sort",
      "C": "sorted",
      "D": "len"
    },
    "correct_answer": "A,B",
    "explanation": "append和sort原地修改；sorted返回新列表，len只读取长度。",
    "difficulty": "应用",
    "user_answer": "",
    "tags": [
      "集合",
      "可变对象"
    ],
    "question_id": "import:d4ba1052bca88f410d743079ba229aff70640ad7e3ca6216aebb93f8a2e337ce"
  },
  {
    "question": "函数体里没有写 return 时，调用这个函数得到的结果是 None。",
    "question_type": "true_false",
    "options": {
      "T": "True",
      "F": "False"
    },
    "correct_answer": "T",
    "explanation": "讲义第1节：没有 return 语句的函数执行完后返回 None。",
    "difficulty": "基础",
    "user_answer": "",
    "tags": [
      "函数",
      "返回值"
    ],
    "question_id": "import:0a6293946b71bab7c7debd3526b86fd432682c20bb5a29332a53534e9c19efdb"
  },
  {
    "question": "print(total) 打印出的数字，可以被调用者直接赋值给变量继续计算。",
    "question_type": "true_false",
    "options": {
      "T": "True",
      "F": "False"
    },
    "correct_answer": "F",
    "explanation": "print 只把内容显示出来，它本身返回 None；要把结果交给调用者必须用 return。",
    "difficulty": "理解",
    "user_answer": "",
    "tags": [
      "函数",
      "返回值"
    ],
    "question_id": "import:e854ee82e4492df8ea62e7bc6cc240933d020399826d0e9b18f82da5e52c5e59"
  },
  {
    "question": "定义 def add(item, bucket=[]): bucket.append(item); return bucket。依次调用 add(1)、add(2)，第二次调用返回什么？",
    "question_type": "single_choice",
    "options": {
      "A": "[2]",
      "B": "[1, 2]",
      "C": "None",
      "D": "抛出 TypeError"
    },
    "correct_answer": "B",
    "explanation": "默认值在定义函数时只求值一次，两次调用共享同一个列表，所以第二次得到 [1, 2]。",
    "difficulty": "应用",
    "user_answer": "",
    "tags": [
      "函数",
      "默认参数",
      "可变对象"
    ],
    "question_id": "import:0ac1c0520c46d7748292da1348c2be6e5d8fbd1db43844bb55991b3b5242747b"
  },
  {
    "question": "为什么不建议把列表这样的可变对象写成默认参数？请给出一种改写方式。",
    "question_type": "short_answer",
    "options": {},
    "correct_answer": "默认值只在定义时创建一次，之后每次调用共享同一个对象；应把默认值设为 None，在函数体内判断后再创建新列表。",
    "explanation": "讲义第2节的 bucket=None 写法让每次调用都得到独立的新列表。",
    "difficulty": "应用",
    "user_answer": "",
    "tags": [
      "函数",
      "默认参数"
    ],
    "question_id": "import:f627b889a17a4b39ee7ef55f0229aec5d8f56398531e907bb499fbf22c8e4212"
  },
  {
    "question": "len({1, 2, 2, 3}) 的结果是 ___。",
    "question_type": "fill_blank",
    "options": {},
    "correct_answer": "3",
    "explanation": "集合字面量会去掉重复的 2，剩下 {1, 2, 3} 三个元素。",
    "difficulty": "基础",
    "user_answer": "",
    "tags": [
      "集合"
    ],
    "question_id": "import:4ede34d10866ff32d07448ce620aafb6f78122450890c349cebf30af115dc58b"
  },
  {
    "question": "下列哪种类型可以作为字典的键？",
    "question_type": "single_choice",
    "options": {
      "A": "list",
      "B": "dict",
      "C": "tuple",
      "D": "set"
    },
    "correct_answer": "C",
    "explanation": "字典的键必须可哈希；元素都不可变的 tuple 可以作为键，list、dict、set 都是可变的。",
    "difficulty": "理解",
    "user_answer": "",
    "tags": [
      "字典",
      "可变对象"
    ],
    "question_id": "import:48d7480263e87250750e99320b2f690ad209fe932a5d176372d1368b73e93970"
  },
  {
    "question": "设 nums = [3, 1, 2]。下列哪些表达式会返回新对象，而 nums 本身保持不变？",
    "question_type": "multi_choice",
    "options": {
      "A": "sorted(nums)",
      "B": "nums.sort()",
      "C": "nums + [4]",
      "D": "nums.append(4)"
    },
    "correct_answer": "A,C",
    "explanation": "sorted 和 + 都生成新列表；sort 与 append 原地修改并返回 None。",
    "difficulty": "应用",
    "user_answer": "",
    "tags": [
      "集合",
      "可变对象"
    ],
    "question_id": "import:54b464c85dde891b30aa842c8915b6d0ba7636419493bcc152fda367d65718c8"
  },
  {
    "question": "表达式 {x * x for x in [1, -1, 2]} 的结果是？",
    "question_type": "single_choice",
    "options": {
      "A": "{1, 4}",
      "B": "[1, 1, 4]",
      "C": "{1, 1, 4}",
      "D": "(1, 4)"
    },
    "correct_answer": "A",
    "explanation": "花括号推导式生成集合，1 和 (-1)² 相同只保留一个。",
    "difficulty": "理解",
    "user_answer": "",
    "tags": [
      "推导式",
      "集合"
    ],
    "question_id": "import:ae4bf4dfb94ed90eae4fabe03b698819bd59792f9603179bc4aa5f451892ce89"
  },
  {
    "question": "scores = {\"ana\": 90}。scores.get(\"ben\", 0) 的结果是？",
    "question_type": "single_choice",
    "options": {
      "A": "抛出 KeyError",
      "B": "0",
      "C": "None",
      "D": "在字典中新增 \"ben\": 0"
    },
    "correct_answer": "B",
    "explanation": "get 在键不存在时返回给出的默认值，不会修改字典；scores[\"ben\"] 才会抛出 KeyError。",
    "difficulty": "基础",
    "user_answer": "",
    "tags": [
      "字典"
    ],
    "question_id": "import:8d7169a213244be7915e243224e06fde07855e2bc74c9b3871650a6bd7fe23a7"
  }
];

export const lessonExample = `# Python：函数与集合

这一讲把两件常被混在一起的事分开：函数怎样把结果交还给调用者，以及哪些集合操作会改变原来的对象。读完后完成右侧练习，答错的题会进入错题与复习清单。

## 1. 函数与返回值

函数把一段可复用的计算封装起来。参数是输入，\`return\` 把结果交还给调用者，调用表达式的值就是这个结果。

\`\`\`python
def total(prices):
    return sum(prices)

subtotal = total([12, 8])   # subtotal == 20
\`\`\`

- \`print\` 只把内容显示出来，它本身返回 \`None\`，调用者拿不到打印的数字。
- 函数体里没有 \`return\`，或只写了 \`return\`，调用结果都是 \`None\`。
- 一个函数可以有多个 \`return\`，执行到第一个就结束。

## 2. 默认参数只求值一次

默认值在 \`def\` 执行时创建一次，之后每次调用共享同一个对象。默认值是列表这样的可变对象时，上一次调用留下的内容会出现在下一次调用里。

\`\`\`python
def add(item, bucket=None):
    if bucket is None:
        bucket = []      # 每次调用都创建新列表
    bucket.append(item)
    return bucket
\`\`\`

## 3. 四种常用集合

- \`list\`：有顺序，允许重复，可以修改。
- \`tuple\`：有顺序，创建后不可修改；元素都不可变时可以作为字典的键。
- \`set\`：元素唯一、无顺序，适合去重和集合运算，例如 \`len({1, 2, 2, 3}) == 3\`。
- \`dict\`：键到值的映射，键必须可哈希。\`d.get(k, 0)\` 在键不存在时返回默认值，\`d[k]\` 则抛出 \`KeyError\`。

## 4. 原地修改还是返回新对象

\`list.append\`、\`list.sort\` 直接修改原列表并返回 \`None\`；\`sorted(nums)\`、\`nums + [4]\` 生成新列表，原列表不变；\`len\` 只读取长度。花括号推导式 \`{x * x for x in nums}\` 生成集合，重复的结果只保留一个。

练习目标：识别集合的用途，解释返回值，判断哪些操作改变原对象，并能改写可变默认参数。`;
