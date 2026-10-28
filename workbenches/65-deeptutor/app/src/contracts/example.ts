export const example: unknown = [
  {
    question: "在Python中，哪个集合会自动去除重复值？",
    question_type: "single_choice",
    options: {
      A: "list",
      B: "set",
      C: "tuple",
      D: "str",
    },
    correct_answer: "B",
    explanation: "set保存唯一元素，可用于集合运算与去重。",
    difficulty: "基础",
    user_answer: "",
    tags: ["集合", "Python"],
    question_id:
      "import:222e57badbd00b244c4065b2078f201e76b1d0d86ac6213fef99e7a8948b24d0",
  },
  {
    question: "函数的返回值有什么作用？请用自己的话解释。",
    question_type: "short_answer",
    options: {},
    correct_answer:
      "把函数内部计算的结果交还给调用者，使程序可以继续使用该结果。",
    explanation: "返回值与打印不同，调用者可以接收并进一步处理。",
    difficulty: "理解",
    user_answer: "",
    tags: ["函数"],
    question_id:
      "import:4de3f4211e2832e2fd6a0fa41c5cda40ffaae717871333358c037041ba7a862e",
  },
  {
    question: "下列哪些操作会改变原列表？",
    question_type: "multi_choice",
    options: {
      A: "append",
      B: "sort",
      C: "sorted",
      D: "len",
    },
    correct_answer: "A,B",
    explanation: "append和sort原地修改；sorted返回新列表，len只读取长度。",
    difficulty: "应用",
    user_answer: "",
    tags: ["集合", "可变对象"],
    question_id:
      "import:d4ba1052bca88f410d743079ba229aff70640ad7e3ca6216aebb93f8a2e337ce",
  },
];
