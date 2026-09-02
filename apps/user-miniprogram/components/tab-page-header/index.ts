import { getNavigationLayout } from '../../utils/navigation';

Component({
  options: {
    multipleSlots: true,
    addGlobalClass: true,
  },

  properties: {
    title: {
      type: String,
      value: '',
    },
  },

  data: getNavigationLayout(),

  lifetimes: {
    attached() {
      this.setData(getNavigationLayout());
    },
  },
});
