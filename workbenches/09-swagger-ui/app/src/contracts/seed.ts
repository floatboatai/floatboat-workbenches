// ABOUTME: 首次打开时的示例规格：社区图书馆借阅 API，第一台服务器由工作台内置示例服务实现。
export const SEED_SOURCE = `openapi: 3.0.3
info:
  title: 社区图书馆借阅 API
  version: 1.4.0
  description: |
    社区图书馆的馆藏、读者与借阅接口。

    - 浏览馆藏无需登录；新增、修改、删除与借阅需要 **Bearer 令牌** 或 **馆员密钥**。
    - 第一台服务器是工作台内置的示例服务，可直接试调；数据只在内存中，服务重启后恢复初始馆藏。
    - 示例令牌：在「Authorize」中为 bearerAuth 填入任意非空值，例如 \`demo-librarian\`。
  contact:
    name: 社区图书馆技术组
    email: tech@library.example.org
  license:
    name: CC BY 4.0
    url: https://creativecommons.org/licenses/by/4.0/
servers:
  - url: /api/sample/library/v1
    description: 工作台内置示例服务（可直接试调）
  - url: https://library.example.org/v1
    description: 示例正式地址（经工作台代理转发）
tags:
  - name: 馆藏
    description: 图书目录与库存
  - name: 读者
    description: 借阅证与联系信息
  - name: 借阅
    description: 借出与归还
  - name: 系统
    description: 服务状态
security:
  - bearerAuth: []
  - librarianKey: []
paths:
  /books:
    get:
      tags: [馆藏]
      summary: 检索馆藏
      operationId: listBooks
      security: []
      parameters:
        - name: q
          in: query
          description: 书名或作者关键词
          schema: { type: string }
          example: 城市
        - name: available
          in: query
          description: 只看可借图书
          schema: { type: boolean }
        - $ref: '#/components/parameters/Page'
        - $ref: '#/components/parameters/PageSize'
      responses:
        '200':
          description: 分页结果
          content:
            application/json:
              schema: { $ref: '#/components/schemas/BookPage' }
    post:
      tags: [馆藏]
      summary: 新增图书
      operationId: createBook
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/BookInput' }
            example:
              title: 河流与城市
              author: 林岚
              isbn: '9787100000017'
              publishedYear: 2021
              copies: 2
      responses:
        '201':
          description: 已加入馆藏
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Book' }
        '400': { $ref: '#/components/responses/Invalid' }
        '401': { $ref: '#/components/responses/Unauthorized' }
  /books/{bookId}:
    parameters:
      - $ref: '#/components/parameters/BookId'
    get:
      tags: [馆藏]
      summary: 查看图书
      operationId: getBook
      security: []
      responses:
        '200':
          description: 图书详情
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Book' }
        '404': { $ref: '#/components/responses/NotFound' }
    put:
      tags: [馆藏]
      summary: 更新图书
      operationId: updateBook
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/BookInput' }
      responses:
        '200':
          description: 已更新
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Book' }
        '400': { $ref: '#/components/responses/Invalid' }
        '401': { $ref: '#/components/responses/Unauthorized' }
        '404': { $ref: '#/components/responses/NotFound' }
    delete:
      tags: [馆藏]
      summary: 下架图书
      operationId: deleteBook
      responses:
        '204':
          description: 已下架
        '401': { $ref: '#/components/responses/Unauthorized' }
        '404': { $ref: '#/components/responses/NotFound' }
        '409':
          description: 仍有未归还的借阅
          content:
            application/problem+json:
              schema: { $ref: '#/components/schemas/Problem' }
  /members:
    get:
      tags: [读者]
      summary: 读者列表
      operationId: listMembers
      responses:
        '200':
          description: 全部读者
          content:
            application/json:
              schema:
                type: array
                items: { $ref: '#/components/schemas/Member' }
        '401': { $ref: '#/components/responses/Unauthorized' }
    post:
      tags: [读者]
      summary: 办理借阅证
      operationId: createMember
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/MemberInput' }
            example:
              name: 周小满
              email: xiaoman@example.org
      responses:
        '201':
          description: 已办理
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Member' }
        '400': { $ref: '#/components/responses/Invalid' }
        '401': { $ref: '#/components/responses/Unauthorized' }
  /members/{memberId}:
    get:
      tags: [读者]
      summary: 查看读者
      operationId: getMember
      parameters:
        - name: memberId
          in: path
          required: true
          schema: { type: string, example: mb_1001 }
      responses:
        '200':
          description: 读者信息
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Member' }
        '401': { $ref: '#/components/responses/Unauthorized' }
        '404': { $ref: '#/components/responses/NotFound' }
  /loans:
    get:
      tags: [借阅]
      summary: 借阅记录
      operationId: listLoans
      parameters:
        - name: memberId
          in: query
          schema: { type: string }
        - name: status
          in: query
          schema:
            type: string
            enum: [active, returned, overdue]
      responses:
        '200':
          description: 借阅记录
          content:
            application/json:
              schema:
                type: array
                items: { $ref: '#/components/schemas/Loan' }
        '401': { $ref: '#/components/responses/Unauthorized' }
    post:
      tags: [借阅]
      summary: 借出图书
      operationId: createLoan
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/LoanInput' }
            example:
              bookId: bk_102
              memberId: mb_1001
              days: 21
      responses:
        '201':
          description: 已借出
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Loan' }
        '400': { $ref: '#/components/responses/Invalid' }
        '401': { $ref: '#/components/responses/Unauthorized' }
        '409':
          description: 没有可借副本
          content:
            application/problem+json:
              schema: { $ref: '#/components/schemas/Problem' }
  /loans/{loanId}/return:
    post:
      tags: [借阅]
      summary: 归还图书
      operationId: returnLoan
      parameters:
        - name: loanId
          in: path
          required: true
          schema: { type: string, example: ln_5001 }
      responses:
        '200':
          description: 已归还
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Loan' }
        '401': { $ref: '#/components/responses/Unauthorized' }
        '404': { $ref: '#/components/responses/NotFound' }
  /status:
    get:
      tags: [系统]
      summary: 服务状态
      operationId: getStatus
      security: []
      responses:
        '200':
          description: 服务可用
          content:
            application/json:
              schema:
                type: object
                properties:
                  status: { type: string, example: ok }
                  books: { type: integer, example: 4 }
                  time: { type: string, format: date-time }
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: 馆员登录后获得的令牌
    librarianKey:
      type: apiKey
      in: header
      name: X-Librarian-Key
      description: 自助借还机使用的固定密钥
  parameters:
    BookId:
      name: bookId
      in: path
      required: true
      schema: { type: string, example: bk_101 }
    Page:
      name: page
      in: query
      schema: { type: integer, minimum: 1, default: 1 }
    PageSize:
      name: pageSize
      in: query
      schema: { type: integer, minimum: 1, maximum: 50, default: 20 }
  responses:
    Invalid:
      description: 字段缺失或格式错误
      content:
        application/problem+json:
          schema: { $ref: '#/components/schemas/Problem' }
    Unauthorized:
      description: 缺少或无效的令牌
      content:
        application/problem+json:
          schema: { $ref: '#/components/schemas/Problem' }
    NotFound:
      description: 资源不存在
      content:
        application/problem+json:
          schema: { $ref: '#/components/schemas/Problem' }
  schemas:
    BookInput:
      type: object
      required: [title, author]
      properties:
        title: { type: string, maxLength: 200, example: 城市的河流 }
        author: { type: string, maxLength: 120, example: 林岚 }
        isbn: { type: string, pattern: '^[0-9]{13}$', example: '9787100000017' }
        publishedYear: { type: integer, minimum: 1450, maximum: 2100, example: 2021 }
        copies: { type: integer, minimum: 0, maximum: 99, default: 1 }
    Book:
      allOf:
        - $ref: '#/components/schemas/BookInput'
        - type: object
          required: [id, available]
          properties:
            id: { type: string, readOnly: true, example: bk_101 }
            available: { type: integer, readOnly: true, description: 可借副本数, example: 1 }
    BookPage:
      type: object
      properties:
        items:
          type: array
          items: { $ref: '#/components/schemas/Book' }
        total: { type: integer, example: 4 }
        page: { type: integer, example: 1 }
        pageSize: { type: integer, example: 20 }
    MemberInput:
      type: object
      required: [name]
      properties:
        name: { type: string, maxLength: 80, example: 周小满 }
        email: { type: string, format: email, example: xiaoman@example.org }
    Member:
      allOf:
        - $ref: '#/components/schemas/MemberInput'
        - type: object
          properties:
            id: { type: string, readOnly: true, example: mb_1001 }
            joinedAt: { type: string, format: date, example: '2025-03-14' }
    LoanInput:
      type: object
      required: [bookId, memberId]
      properties:
        bookId: { type: string, example: bk_102 }
        memberId: { type: string, example: mb_1001 }
        days: { type: integer, minimum: 1, maximum: 60, default: 21 }
    Loan:
      type: object
      properties:
        id: { type: string, example: ln_5001 }
        bookId: { type: string, example: bk_102 }
        memberId: { type: string, example: mb_1001 }
        status:
          type: string
          enum: [active, returned, overdue]
        borrowedAt: { type: string, format: date-time }
        dueAt: { type: string, format: date-time }
        returnedAt: { type: string, format: date-time, nullable: true }
    Problem:
      type: object
      description: RFC 9457 错误描述
      properties:
        type: { type: string, example: about:blank }
        title: { type: string, example: 未找到 }
        status: { type: integer, example: 404 }
        detail: { type: string, example: 没有编号为 bk_999 的图书 }
`;

export const BLANK_SOURCE = `openapi: 3.0.3
info:
  title: 新接口规格
  version: 0.1.0
servers:
  - url: https://api.example.com
paths: {}
`;
