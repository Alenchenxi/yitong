// P2-79 去百度地图:微信原生地图选点共用封装。
// 发岗页 / 商家面板 / 圈子创建三处共用;直接调 wx.chooseLocation(自带地图+搜索+定位,
// 隐私弹窗由框架自动处理),不预定位——只需 scope.userLocation 授权一次。
// 返回坐标为 GCJ-02(微信系);服务端 createPost 契约同坐标系,前端原样提交、禁止回填 VO 的 BD-09 坐标。
// 用户取消或失败返回 null(静默,不弹额外提示;失败原因由微信自带 UI 呈现)。

export interface ChosenLocation {
  name: string;
  address: string;
  lng: number;
  lat: number;
}

export function chooseLocation(): Promise<ChosenLocation | null> {
  return new Promise((resolve) => {
    wx.chooseLocation({
      success: (res) => {
        if (!res.name && !res.address) {
          resolve(null);
          return;
        }
        resolve({
          name: res.name || res.address,
          address: res.address || res.name,
          lng: res.longitude,
          lat: res.latitude,
        });
      },
      fail: () => resolve(null),
    });
  });
}
