// Interactive previews derive their English task data from the canonical recipes.
import samples from '@site/static/cookbook/code/samples.json';
export const cookbook = [
  {id: 'text', input: samples.ticket.text, question: {...samples.ticket.questions[0], name: 'q0'}, asset: null},
  {id: 'image', input: 'Answer using only the visible image.', question: {...samples.product.question, name: 'q0'}, asset: '/cookbook/sheep.jpg'},
  {id: 'video', input: 'Answer using only the visible image.', question: {...samples.video.question, name: 'q0'}, asset: '/cookbook/momos-frame.jpg'},
] as const;

// Chinese adaptations keep the same image assets and API choice identifiers.
const chinese = [
  {
    input: '我搬家了，可以把订单寄到榆树街 12 号，而不是原来的地址吗？',
    instructions: '这条客户消息表达了什么意图？',
    descriptions: ['咨询费用、发票或付款', '取消订单', '更改收货地址', '反馈收到的商品破损', '查询订单位置或预计送达时间'],
  },
  {
    input: '请仅根据图片中可见的内容回答问题。',
    instructions: '图片中的这群动物应该怎样称呼？',
    descriptions: ['狮群', '羊群', '猫群', '猴群'],
  },
  {
    input: '请仅根据视频画面中可见的内容回答问题。',
    instructions: '左边铝箔容器里的酱料是什么颜色？',
    descriptions: ['棕色', '白色', '红色', '橙色'],
  },
];
export function getCookbook(zh: boolean) {
  return cookbook.map((example, index) => ({
    ...example,
    input: zh ? chinese[index].input : example.input,
    question: {
      ...example.question,
      instructions: zh ? chinese[index].instructions : example.question.instructions,
      choices: example.question.choices.map((choice, i) => ({
        ...choice,
        description: zh ? chinese[index].descriptions[i] : choice.description,
      })),
    },
  }));
}
