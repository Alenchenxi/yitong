import { FAQ_LIST } from '../../../services/faq-data';

Page({
  data: {
    items: FAQ_LIST.filter((f) => f.category === 'apply_rules'),
  },
});

