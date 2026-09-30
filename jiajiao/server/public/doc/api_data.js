define({ "api": [
  {
    "type": "get",
    "url": "/Base/captcha",
    "title": "02、图片验证码地址",
    "group": "Base",
    "version": "1.0.0",
    "description": "<p>图片验证码</p>",
    "success": {
      "examples": [
        {
          "title": "01 调用示例",
          "content": "<img src=\"http://xxxx.com/Base/captcha\" onClick=\"this.src=this.src+'?'+Math.random()\" alt=\"点击刷新验证码\">",
          "type": "json"
        }
      ]
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/Base.php",
    "groupTitle": "Base",
    "name": "GetBaseCaptcha"
  },
  {
    "type": "post",
    "url": "/Base/upload",
    "title": "01、图片上传",
    "group": "Base",
    "version": "1.0.0",
    "description": "<p>图片上传</p>",
    "header": {
      "fields": {
        "Header": [
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "Authorization",
            "description": "<p>用户授权token</p>"
          }
        ]
      },
      "examples": [
        {
          "title": "Header-示例:",
          "content": "\"Authorization: eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOjM2NzgsImF1ZGllbmNlIjoid2ViIiwib3BlbkFJZCI6MTM2NywiY3JlYXRlZCI6MTUzMzg3OTM2ODA0Nywicm9sZXMiOiJVU0VSIiwiZXhwIjoxNTM0NDg0MTY4fQ.Gl5L-NpuwhjuPXFuhPax8ak5c64skjDTCBC64N_QdKQ2VT-zZeceuzXB9TqaYJuhkwNYEhrV3pUx1zhMWG7Org\"",
          "type": "json"
        }
      ]
    },
    "parameter": {
      "fields": {
        "失败返回参数：": [
          {
            "group": "失败返回参数：",
            "type": "object",
            "optional": false,
            "field": "array",
            "description": "<p>返回结果集</p>"
          },
          {
            "group": "失败返回参数：",
            "type": "string",
            "optional": false,
            "field": "array.status",
            "description": "<p>返回错误码  201</p>"
          },
          {
            "group": "失败返回参数：",
            "type": "string",
            "optional": false,
            "field": "array.msg",
            "description": "<p>返回错误消息</p>"
          }
        ],
        "成功返回参数：": [
          {
            "group": "成功返回参数：",
            "type": "string",
            "optional": false,
            "field": "array",
            "description": "<p>返回结果集</p>"
          },
          {
            "group": "成功返回参数：",
            "type": "string",
            "optional": false,
            "field": "array.status",
            "description": "<p>返回错误码 200</p>"
          },
          {
            "group": "成功返回参数：",
            "type": "string",
            "optional": false,
            "field": "array.data",
            "description": "<p>返回图片地址</p>"
          }
        ]
      }
    },
    "success": {
      "examples": [
        {
          "title": "01 成功示例",
          "content": "{\"status\":\"200\",\"data\":\"操作成功\"}",
          "type": "json"
        }
      ]
    },
    "error": {
      "examples": [
        {
          "title": "02 失败示例",
          "content": "{\"status\":\" 201\",\"msg\":\"操作失败\"}",
          "type": "json"
        }
      ]
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/Base.php",
    "groupTitle": "Base",
    "name": "PostBaseUpload"
  },
  {
    "type": "post",
    "url": "/task/updateStickTime",
    "title": "01、 执行修改 置顶到期时间 (分钟)",
    "group": "Task",
    "version": "1.0.0",
    "description": "<p>执行修改 置顶到期时间</p>",
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/Task.php",
    "groupTitle": "Task",
    "name": "PostTaskUpdatesticktime"
  },
  {
    "type": "post",
    "url": "/user/addAppointment",
    "title": "11、 添加预约",
    "group": "会员",
    "version": "1.0.0",
    "description": "<p>添加预约</p>",
    "header": {
      "fields": {
        "Header": [
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "Authorization",
            "description": "<p>用户授权token</p>"
          }
        ]
      }
    },
    "parameter": {
      "fields": {
        "输入参数：": [
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "teacher_id",
            "description": "<p>教师id</p>"
          },
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "demand_id",
            "description": "<p>需求id</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/User.php",
    "groupTitle": "会员",
    "name": "PostUserAddappointment"
  },
  {
    "type": "post",
    "url": "/user/addComment",
    "title": "07、 发表评论",
    "group": "会员",
    "version": "1.0.0",
    "description": "<p>发表评论</p>",
    "header": {
      "fields": {
        "Header": [
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "Authorization",
            "description": "<p>用户授权token</p>"
          }
        ]
      }
    },
    "parameter": {
      "fields": {
        "输入参数：": [
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "order_id",
            "description": "<p>订单id</p>"
          },
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "demand_id",
            "description": "<p>需求id</p>"
          },
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "teacher_id",
            "description": "<p>老师id</p>"
          },
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "attitude",
            "description": "<p>教学态度   1星|1|primary,2星|2|success,3星|3|info,4星|4|warning,5星|5|danger</p>"
          },
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "level",
            "description": "<p>专业等级  1星|1|primary,2星|2|success,3星|3|info,4星|4|warning,5星|5|danger</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "content",
            "description": "<p>评价内容</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "pics",
            "description": "<p>图片  多个用 , 隔开</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "sup_comment_id",
            "description": "<p>上级评论id  不传为0</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/User.php",
    "groupTitle": "会员",
    "name": "PostUserAddcomment"
  },
  {
    "type": "post",
    "url": "/user/addOrCancelCollect",
    "title": "10、 添加或取消收藏",
    "group": "会员",
    "version": "1.0.0",
    "description": "<p>添加或取消收藏</p>",
    "header": {
      "fields": {
        "Header": [
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "Authorization",
            "description": "<p>用户授权token</p>"
          }
        ]
      }
    },
    "parameter": {
      "fields": {
        "输入参数：": [
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "teacher_id",
            "description": "<p>教师id</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/User.php",
    "groupTitle": "会员",
    "name": "PostUserAddorcancelcollect"
  },
  {
    "type": "post",
    "url": "/user/feedback",
    "title": "05、 意见反馈",
    "group": "会员",
    "version": "1.0.0",
    "description": "<p>意见反馈</p>",
    "header": {
      "fields": {
        "Header": [
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "Authorization",
            "description": "<p>用户授权token</p>"
          }
        ]
      }
    },
    "parameter": {
      "fields": {
        "输入参数：": [
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "content",
            "description": "<p>反馈内容</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "img",
            "description": "<p>图片</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/User.php",
    "groupTitle": "会员",
    "name": "PostUserFeedback"
  },
  {
    "type": "post",
    "url": "/user/getDelDemand",
    "title": "15、 关闭学生需求(订单)",
    "group": "会员",
    "version": "1.0.0",
    "description": "<p>删除学生需求(订单)</p>",
    "header": {
      "fields": {
        "Header": [
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "Authorization",
            "description": "<p>用户授权token</p>"
          }
        ]
      }
    },
    "parameter": {
      "fields": {
        "输入参数：": [
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "demand_id",
            "description": "<p>需求id</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/User.php",
    "groupTitle": "会员",
    "name": "PostUserGetdeldemand"
  },
  {
    "type": "post",
    "url": "/user/getMsgList",
    "title": "17、 获取消息列表",
    "group": "会员",
    "version": "1.0.0",
    "description": "<p>获取消息列表</p>",
    "header": {
      "fields": {
        "Header": [
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "Authorization",
            "description": "<p>用户授权token</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/User.php",
    "groupTitle": "会员",
    "name": "PostUserGetmsglist"
  },
  {
    "type": "post",
    "url": "/user/getMyCollectList",
    "title": "08、 获取我的收藏列表",
    "group": "会员",
    "version": "1.0.0",
    "description": "<p>获取我的收藏列表</p>",
    "header": {
      "fields": {
        "Header": [
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "Authorization",
            "description": "<p>用户授权token</p>"
          }
        ]
      }
    },
    "parameter": {
      "fields": {
        "输入参数：": [
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "limit",
            "description": "<p>数量</p>"
          },
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "page",
            "description": "<p>页数</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/User.php",
    "groupTitle": "会员",
    "name": "PostUserGetmycollectlist"
  },
  {
    "type": "post",
    "url": "/user/getMyCommentList",
    "title": "04、 获取我的评论列表",
    "group": "会员",
    "version": "1.0.0",
    "description": "<p>获取我的评论列表</p>",
    "header": {
      "fields": {
        "Header": [
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "Authorization",
            "description": "<p>用户授权token</p>"
          }
        ]
      }
    },
    "parameter": {
      "fields": {
        "输入参数：": [
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "limit",
            "description": "<p>数量</p>"
          },
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "page",
            "description": "<p>页数</p>"
          },
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "teacher_id",
            "description": "<p>老师id</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/User.php",
    "groupTitle": "会员",
    "name": "PostUserGetmycommentlist"
  },
  {
    "type": "post",
    "url": "/user/getMyFileList",
    "title": "18、 获取我得文件列表",
    "group": "会员",
    "version": "1.0.0",
    "description": "<p>获取我得文件列表</p>",
    "header": {
      "fields": {
        "Header": [
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "Authorization",
            "description": "<p>用户授权token</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/User.php",
    "groupTitle": "会员",
    "name": "PostUserGetmyfilelist"
  },
  {
    "type": "post",
    "url": "/user/getStuAppointmentList",
    "title": "13、 获取学生预约订单",
    "group": "会员",
    "version": "1.0.0",
    "description": "<p>获取学生预约订单</p>",
    "parameter": {
      "fields": {
        "输入参数：": [
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "limit",
            "description": "<p>数量</p>"
          },
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "page",
            "description": "<p>页数</p>"
          },
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "demand_id",
            "description": "<p>需求id</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/User.php",
    "groupTitle": "会员",
    "name": "PostUserGetstuappointmentlist"
  },
  {
    "type": "post",
    "url": "/user/getStuDemandList",
    "title": "15、 获取学生订单",
    "group": "会员",
    "version": "1.0.0",
    "description": "<p>获取学生订单</p>",
    "header": {
      "fields": {
        "Header": [
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "Authorization",
            "description": "<p>用户授权token</p>"
          }
        ]
      }
    },
    "parameter": {
      "fields": {
        "输入参数：": [
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "limit",
            "description": "<p>数量</p>"
          },
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "page",
            "description": "<p>页数</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/User.php",
    "groupTitle": "会员",
    "name": "PostUserGetstudemandlist"
  },
  {
    "type": "post",
    "url": "/user/getTeacherAppointmentList",
    "title": "12、 获取老师预约订单",
    "group": "会员",
    "version": "1.0.0",
    "description": "<p>获取老师预约订单</p>",
    "header": {
      "fields": {
        "Header": [
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "Authorization",
            "description": "<p>用户授权token</p>"
          }
        ]
      }
    },
    "parameter": {
      "fields": {
        "输入参数：": [
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "limit",
            "description": "<p>数量</p>"
          },
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "page",
            "description": "<p>页数</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/User.php",
    "groupTitle": "会员",
    "name": "PostUserGetteacherappointmentlist"
  },
  {
    "type": "post",
    "url": "/user/getUserInfo",
    "title": "01、 获取个人资料",
    "group": "会员",
    "version": "1.0.0",
    "description": "<p>获取个人资料</p>",
    "header": {
      "fields": {
        "Header": [
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "Authorization",
            "description": "<p>用户授权token</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/User.php",
    "groupTitle": "会员",
    "name": "PostUserGetuserinfo"
  },
  {
    "type": "post",
    "url": "/user/hideOrOpenResume",
    "title": "16、 隐藏或打开简历",
    "group": "会员",
    "version": "1.0.0",
    "description": "<p>隐藏简历</p>",
    "header": {
      "fields": {
        "Header": [
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "Authorization",
            "description": "<p>用户授权token</p>"
          }
        ]
      }
    },
    "parameter": {
      "fields": {
        "输入参数：": [
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "teacher_id",
            "description": "<p>教师id</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/User.php",
    "groupTitle": "会员",
    "name": "PostUserHideoropenresume"
  },
  {
    "type": "post",
    "url": "/user/logout",
    "title": "06、 注销",
    "group": "会员",
    "version": "1.0.0",
    "description": "<p>注销</p>",
    "header": {
      "fields": {
        "Header": [
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "Authorization",
            "description": "<p>用户授权token</p>"
          }
        ]
      }
    },
    "parameter": {
      "fields": {
        "输入参数：": [
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "content",
            "description": "<p>注销原因</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/User.php",
    "groupTitle": "会员",
    "name": "PostUserLogout"
  },
  {
    "type": "post",
    "url": "/user/refreshCv",
    "title": "14、 刷新简历",
    "group": "会员",
    "version": "1.0.0",
    "description": "<p>刷新简历</p>",
    "header": {
      "fields": {
        "Header": [
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "Authorization",
            "description": "<p>用户授权token</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/User.php",
    "groupTitle": "会员",
    "name": "PostUserRefreshcv"
  },
  {
    "type": "post",
    "url": "/user/studentsRelease",
    "title": "03、 学员发布",
    "group": "会员",
    "version": "1.0.0",
    "description": "<p>学员发布</p>",
    "header": {
      "fields": {
        "Header": [
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "Authorization",
            "description": "<p>用户授权token</p>"
          }
        ]
      }
    },
    "parameter": {
      "fields": {
        "输入参数：": [
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "demand_id",
            "description": "<p>需求id  传为修改  不传为添加</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "name",
            "description": "<p>姓名</p>"
          },
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "mobile",
            "description": "<p>联系方式</p>"
          },
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "teaching_way",
            "description": "<p>授课方式  上门授课|1|primary,在线授课|2|success,均可|3|info</p>"
          },
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "age",
            "description": "<p>年龄</p>"
          },
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "gender",
            "description": "<p>性别  男|1|success,女|2|warning</p>"
          },
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "category_id",
            "description": "<p>分类id</p>"
          },
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "grade_id",
            "description": "<p>年级id</p>"
          },
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "subject_id",
            "description": "<p>任教科目</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "school",
            "description": "<p>在读学校</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "gai_kuang",
            "description": "<p>学员概况</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "province",
            "description": "<p>省</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "city",
            "description": "<p>城市</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "area",
            "description": "<p>任教区域名称</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "address",
            "description": "<p>详细地址</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "trial_time",
            "description": "<p>试课时间</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "teacher_gender",
            "description": "<p>教员性别  男|1|success,女|2|warning</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "teacher_identity",
            "description": "<p>教师身份  大学生教员|1|primary,专业教员|2|success,均可|3|danger</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "teacher_require",
            "description": "<p>教员要求</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "schooltime_json",
            "description": "<p>上课时间 [{&quot;week&quot;:&quot;周一&quot;,&quot;start_time&quot;:&quot;08:00&quot;,&quot;end_time&quot;:&quot;12:00&quot;}]</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "longitude",
            "description": "<p>经度</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "latitude",
            "description": "<p>纬度</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/User.php",
    "groupTitle": "会员",
    "name": "PostUserStudentsrelease"
  },
  {
    "type": "post",
    "url": "/user/teacherReg",
    "title": "09、 教师注册",
    "group": "会员",
    "version": "1.0.0",
    "description": "<p>教师注册</p>",
    "header": {
      "fields": {
        "Header": [
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "Authorization",
            "description": "<p>用户授权token</p>"
          }
        ]
      }
    },
    "parameter": {
      "fields": {
        "输入参数：": [
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "mobile",
            "description": "<p>联系方式</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "wechat",
            "description": "<p>微信号</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "nickname",
            "description": "<p>微信昵称</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "name",
            "description": "<p>姓名</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "id_number",
            "description": "<p>身份证号码</p>"
          },
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "age",
            "description": "<p>年龄</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "gender",
            "description": "<p>性别  男|1|success,女|2|warning</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "id_card_zheng",
            "description": "<p>身份证正面</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "id_card_fan",
            "description": "<p>身份证反面</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "student_card_img",
            "description": "<p>学生证</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "diploma_img",
            "description": "<p>学历证</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "itic_img",
            "description": "<p>教师证</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "head_img",
            "description": "<p>头像</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "teaching_age",
            "description": "<p>教龄</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "school",
            "description": "<p>学校</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "school_start_time",
            "description": "<p>学校就读开始时间</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "school_end_time",
            "description": "<p>学校就读结束时间</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "education",
            "description": "<p>学历</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "specialty",
            "description": "<p>专业</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "teacher_identity",
            "description": "<p>教师身份  大学生教员|1|primary,专职教员|2|success</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "experience_json",
            "description": "<p>任教经历 [{&quot;title&quot;:&quot;标题&quot;,&quot;experience&quot;:&quot;任教经理&quot;,&quot;start_time&quot;:&quot;&quot;,&quot;end_time&quot;:&quot;&quot;}]</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "successful_case_title",
            "description": "<p>成功案例标题</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "successful_case",
            "description": "<p>成功案例</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "honor",
            "description": "<p>奖励荣誉</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "honor_img",
            "description": "<p>奖励荣誉图片</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "teacher_title",
            "description": "<p>教师职称</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "teacher_title_img",
            "description": "<p>教师职称证书</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "label",
            "description": "<p>个人标签  多个用 , 隔开</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "province",
            "description": "<p>省</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "city",
            "description": "<p>市</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "area",
            "description": "<p>区  多个用 , 隔开</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "photos",
            "description": "<p>个人照片   多个用 , 隔开</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "works",
            "description": "<p>个人作品</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "schooltime_json",
            "description": "<p>上课时间 [{&quot;week&quot;:&quot;周一&quot;,&quot;start_time&quot;:&quot;08:00&quot;,&quot;end_time&quot;:&quot;12:00&quot;}]</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "teaching_subject_json",
            "description": "<p>教授课程 [{&quot;category_id&quot;:1,&quot;grade_id&quot;:1,&quot;subject_id&quot;:1,&quot;is_main&quot;:1}]</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "longitude",
            "description": "<p>经度</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "latitude",
            "description": "<p>纬度</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/User.php",
    "groupTitle": "会员",
    "name": "PostUserTeacherreg"
  },
  {
    "type": "post",
    "url": "/user/updateUserInfo",
    "title": "02、 保存个人资料",
    "group": "会员",
    "version": "1.0.0",
    "description": "<p>保存个人资料</p>",
    "header": {
      "fields": {
        "Header": [
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "Authorization",
            "description": "<p>用户授权token</p>"
          }
        ]
      }
    },
    "parameter": {
      "fields": {
        "输入参数：": [
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "mobile",
            "description": "<p>手机号</p>"
          },
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "gender",
            "description": "<p>性别   男|1|success,女|2|warning</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "birthdate",
            "description": "<p>出生日期  时间戳格式</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/User.php",
    "groupTitle": "会员",
    "name": "PostUserUpdateuserinfo"
  },
  {
    "type": "post",
    "url": "/Login/login",
    "title": "01、小程序登录",
    "group": "登陆",
    "version": "1.0.0",
    "description": "<p>小程序登录</p>",
    "parameter": {
      "fields": {
        "输入参数：": [
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "code",
            "description": "<p>小程序传入</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "encryptedData",
            "description": "<p>小程序传入</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "iv",
            "description": "<p>小程序传入</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/Login.php",
    "groupTitle": "登陆",
    "name": "PostLoginLogin"
  },
  {
    "type": "post",
    "url": "/login/mobile",
    "title": "02、手机号登陆",
    "group": "登陆",
    "version": "1.0.0",
    "description": "<p>获取手机号</p>",
    "parameter": {
      "fields": {
        "输入参数：": [
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "code",
            "description": "<p>小程序传入</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "encryptedData",
            "description": "<p>小程序传入</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "iv",
            "description": "<p>小程序传入</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/Login.php",
    "groupTitle": "登陆",
    "name": "PostLoginMobile"
  },
  {
    "type": "post",
    "url": "/login/mobileLogin",
    "title": "03、 手机号,验证码登陆",
    "group": "登陆",
    "version": "1.0.0",
    "description": "<p>手机号,验证码登陆</p>",
    "parameter": {
      "fields": {
        "输入参数：": [
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "code",
            "description": "<p>小程序传入</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "mobile",
            "description": "<p>手机号</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "verify",
            "description": "<p>验证码</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/Login.php",
    "groupTitle": "登陆",
    "name": "PostLoginMobilelogin"
  },
  {
    "type": "post",
    "url": "/login/sendMobileCode",
    "title": "04、 发送手机验证码",
    "group": "登陆",
    "version": "1.0.0",
    "description": "<p>获取手机号</p>",
    "parameter": {
      "fields": {
        "输入参数：": [
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "mobile",
            "description": "<p>手机号</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/Login.php",
    "groupTitle": "登陆",
    "name": "PostLoginSendmobilecode"
  },
  {
    "type": "post",
    "url": "/login/verifyMobile",
    "title": "03、 验证手机号",
    "group": "登陆",
    "version": "1.0.0",
    "description": "<p>验证手机号</p>",
    "parameter": {
      "fields": {
        "输入参数：": [
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "mobile",
            "description": "<p>手机号</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "verify",
            "description": "<p>验证码</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/Login.php",
    "groupTitle": "登陆",
    "name": "PostLoginVerifymobile"
  },
  {
    "type": "post",
    "url": "/order/createFileDownloadOrder",
    "title": "07、创建购买文件支付订单",
    "group": "订单",
    "version": "1.0.0",
    "description": "<p>创建订单</p>",
    "header": {
      "fields": {
        "Header": [
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "Authorization",
            "description": "<p>用户授权token</p>"
          }
        ]
      }
    },
    "parameter": {
      "fields": {
        "传入参数：": [
          {
            "group": "传入参数：",
            "type": "number",
            "optional": false,
            "field": "file_download_id",
            "description": "<p>文件id</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/Order.php",
    "groupTitle": "订单",
    "name": "PostOrderCreatefiledownloadorder"
  },
  {
    "type": "post",
    "url": "/order/createOrder",
    "title": "01、创建订单",
    "group": "订单",
    "version": "1.0.0",
    "description": "<p>创建订单</p>",
    "header": {
      "fields": {
        "Header": [
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "Authorization",
            "description": "<p>用户授权token</p>"
          }
        ]
      }
    },
    "parameter": {
      "fields": {
        "传入参数：": [
          {
            "group": "传入参数：",
            "type": "number",
            "optional": false,
            "field": "teacher_id",
            "description": "<p>教师id</p>"
          },
          {
            "group": "传入参数：",
            "type": "number",
            "optional": false,
            "field": "teaching_way",
            "description": "<p>任教方式  上门授课|1|primary,在线授课|2|success,均可|3|info</p>"
          },
          {
            "group": "传入参数：",
            "type": "string",
            "optional": false,
            "field": "linkman",
            "description": "<p>联系人</p>"
          },
          {
            "group": "传入参数：",
            "type": "string",
            "optional": false,
            "field": "mobile",
            "description": "<p>手机号</p>"
          },
          {
            "group": "传入参数：",
            "type": "string",
            "optional": false,
            "field": "province",
            "description": "<p>省</p>"
          },
          {
            "group": "传入参数：",
            "type": "string",
            "optional": false,
            "field": "city",
            "description": "<p>市</p>"
          },
          {
            "group": "传入参数：",
            "type": "string",
            "optional": false,
            "field": "area",
            "description": "<p>区</p>"
          },
          {
            "group": "传入参数：",
            "type": "string",
            "optional": false,
            "field": "address",
            "description": "<p>详细地址</p>"
          },
          {
            "group": "传入参数：",
            "type": "number",
            "optional": false,
            "field": "teaching_subject_id",
            "description": "<p>选择老师授教科目id</p>"
          },
          {
            "group": "传入参数：",
            "type": "number",
            "optional": false,
            "field": "hour",
            "description": "<p>课时</p>"
          },
          {
            "group": "传入参数：",
            "type": "number",
            "optional": false,
            "field": "weeks",
            "description": "<p>周几上课   多个id , 隔开</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/Order.php",
    "groupTitle": "订单",
    "name": "PostOrderCreateorder"
  },
  {
    "type": "post",
    "url": "/order/createTcOrder",
    "title": "02、创建套餐订单",
    "group": "订单",
    "version": "1.0.0",
    "description": "<p>创建套餐订单</p>",
    "header": {
      "fields": {
        "Header": [
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "Authorization",
            "description": "<p>用户授权token</p>"
          }
        ]
      }
    },
    "parameter": {
      "fields": {
        "传入参数：": [
          {
            "group": "传入参数：",
            "type": "number",
            "optional": false,
            "field": "set_meal_id",
            "description": "<p>套餐id</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/Order.php",
    "groupTitle": "订单",
    "name": "PostOrderCreatetcorder"
  },
  {
    "type": "post",
    "url": "/order/getStuOrderList",
    "title": "03、 获取学生订单列表",
    "group": "订单",
    "version": "1.0.0",
    "description": "<p>获取学生订单列表</p>",
    "header": {
      "fields": {
        "Header": [
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "Authorization",
            "description": "<p>用户授权token</p>"
          }
        ]
      }
    },
    "parameter": {
      "fields": {
        "输入参数：": [
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "limit",
            "description": "<p>数量</p>"
          },
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "page",
            "description": "<p>页数</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "order_state",
            "description": "<p>状态  全部 1  不传默认0</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/Order.php",
    "groupTitle": "订单",
    "name": "PostOrderGetstuorderlist"
  },
  {
    "type": "post",
    "url": "/order/getTeaOrderList",
    "title": "04、 获取老师订单列表",
    "group": "订单",
    "version": "1.0.0",
    "description": "<p>获取老师订单列表</p>",
    "header": {
      "fields": {
        "Header": [
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "Authorization",
            "description": "<p>用户授权token</p>"
          }
        ]
      }
    },
    "parameter": {
      "fields": {
        "输入参数：": [
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "limit",
            "description": "<p>数量</p>"
          },
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "page",
            "description": "<p>页数</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/Order.php",
    "groupTitle": "订单",
    "name": "PostOrderGetteaorderlist"
  },
  {
    "type": "post",
    "url": "/order/msgConfirmOrCancel",
    "title": "06、 确定/取消减少订单课时",
    "group": "订单",
    "version": "1.0.0",
    "description": "<p>确定/取消减少订单课时</p>",
    "header": {
      "fields": {
        "Header": [
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "Authorization",
            "description": "<p>用户授权token</p>"
          }
        ]
      }
    },
    "parameter": {
      "fields": {
        "输入参数：": [
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "msg_id",
            "description": "<p>消息id</p>"
          },
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "status",
            "description": "<p>1确认 2取消</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/Order.php",
    "groupTitle": "订单",
    "name": "PostOrderMsgconfirmorcancel"
  },
  {
    "type": "post",
    "url": "/order/reduceOrderHours",
    "title": "06、 减少订单课时",
    "group": "订单",
    "version": "1.0.0",
    "description": "<p>减少订单课时</p>",
    "header": {
      "fields": {
        "Header": [
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "Authorization",
            "description": "<p>用户授权token</p>"
          }
        ]
      }
    },
    "parameter": {
      "fields": {
        "输入参数：": [
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "order_id",
            "description": "<p>订单id</p>"
          },
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "num",
            "description": "<p>减少课时数量</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/Order.php",
    "groupTitle": "订单",
    "name": "PostOrderReduceorderhours"
  },
  {
    "type": "post",
    "url": "/order/wxPay",
    "title": "02、微信支付",
    "group": "订单",
    "version": "1.0.0",
    "description": "<p>微信支付</p>",
    "header": {
      "fields": {
        "Header": [
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "Authorization",
            "description": "<p>用户授权token</p>"
          }
        ]
      }
    },
    "parameter": {
      "fields": {
        "传入参数：": [
          {
            "group": "传入参数：",
            "type": "number",
            "optional": false,
            "field": "order_id",
            "description": "<p>订单id</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/Order.php",
    "groupTitle": "订单",
    "name": "PostOrderWxpay"
  },
  {
    "type": "post",
    "url": "/order/wxPayAppointment",
    "title": "05、微信支付预约订单",
    "group": "订单",
    "version": "1.0.0",
    "description": "<p>微信支付预约订单</p>",
    "header": {
      "fields": {
        "Header": [
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "Authorization",
            "description": "<p>用户授权token</p>"
          }
        ]
      }
    },
    "parameter": {
      "fields": {
        "传入参数：": [
          {
            "group": "传入参数：",
            "type": "number",
            "optional": false,
            "field": "appointment_id",
            "description": "<p>预约订单id</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/Order.php",
    "groupTitle": "订单",
    "name": "PostOrderWxpayappointment"
  },
  {
    "type": "post",
    "url": "/order/wxPayFileDownloadOrder",
    "title": "08、微信支付购买文件订单",
    "group": "订单",
    "version": "1.0.0",
    "description": "<p>微信支付购买文件订单</p>",
    "header": {
      "fields": {
        "Header": [
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "Authorization",
            "description": "<p>用户授权token</p>"
          }
        ]
      }
    },
    "parameter": {
      "fields": {
        "传入参数：": [
          {
            "group": "传入参数：",
            "type": "number",
            "optional": false,
            "field": "file_download_order_id",
            "description": "<p>订单id</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/Order.php",
    "groupTitle": "订单",
    "name": "PostOrderWxpayfiledownloadorder"
  },
  {
    "type": "post",
    "url": "/demand/applyRefundDemand",
    "title": "6、 需求订单申请退款",
    "group": "需求管理",
    "version": "1.0.0",
    "description": "<p>需求订单申请退款</p>",
    "header": {
      "fields": {
        "Header": [
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "Authorization",
            "description": "<p>用户授权token</p>"
          }
        ]
      }
    },
    "parameter": {
      "fields": {
        "输入参数：": [
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "demand_id",
            "description": "<p>需求id</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/Demand.php",
    "groupTitle": "需求管理",
    "name": "PostDemandApplyrefunddemand"
  },
  {
    "type": "post",
    "url": "/demand/confirmFinish",
    "title": "3、 确认完成",
    "group": "需求管理",
    "version": "1.0.0",
    "description": "<p>确认完成</p>",
    "header": {
      "fields": {
        "Header": [
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "Authorization",
            "description": "<p>用户授权token</p>"
          }
        ]
      }
    },
    "parameter": {
      "fields": {
        "输入参数：": [
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "demand_id",
            "description": "<p>需求id</p>"
          },
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "order_id",
            "description": "<p>老师联系订单id</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/Demand.php",
    "groupTitle": "需求管理",
    "name": "PostDemandConfirmfinish"
  },
  {
    "type": "post",
    "url": "/demand/contactDemand",
    "title": "5、 老师联系需求添加记录",
    "group": "需求管理",
    "version": "1.0.0",
    "description": "<p>老师联系需求添加记录</p>",
    "header": {
      "fields": {
        "Header": [
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "Authorization",
            "description": "<p>用户授权token</p>"
          }
        ]
      }
    },
    "parameter": {
      "fields": {
        "输入参数：": [
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "demand_id",
            "description": "<p>需求id</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/Demand.php",
    "groupTitle": "需求管理",
    "name": "PostDemandContactdemand"
  },
  {
    "type": "post",
    "url": "/demand/contactTeacher",
    "title": "6、 联系老师",
    "group": "需求管理",
    "version": "1.0.0",
    "description": "<p>联系老师</p>",
    "header": {
      "fields": {
        "Header": [
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "Authorization",
            "description": "<p>用户授权token</p>"
          }
        ]
      }
    },
    "parameter": {
      "fields": {
        "输入参数：": [
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "teacher_id",
            "description": "<p>老师id</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "city",
            "description": "<p>当前城市</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/Demand.php",
    "groupTitle": "需求管理",
    "name": "PostDemandContactteacher"
  },
  {
    "type": "post",
    "url": "/demand/getDemandOrderList",
    "title": "4、 获取老师联系需求列表",
    "group": "需求管理",
    "version": "1.0.0",
    "description": "<p>获取老师联系需求列表</p>",
    "parameter": {
      "fields": {
        "输入参数：": [
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "demand_id",
            "description": "<p>需求id</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/Demand.php",
    "groupTitle": "需求管理",
    "name": "PostDemandGetdemandorderlist"
  },
  {
    "type": "post",
    "url": "/demand/hideOrShowDemand",
    "title": "2、 隐藏/显示需求",
    "group": "需求管理",
    "version": "1.0.0",
    "description": "<p>隐藏/显示需求</p>",
    "header": {
      "fields": {
        "Header": [
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "Authorization",
            "description": "<p>用户授权token</p>"
          }
        ]
      }
    },
    "parameter": {
      "fields": {
        "输入参数：": [
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "demand_id",
            "description": "<p>需求id</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/Demand.php",
    "groupTitle": "需求管理",
    "name": "PostDemandHideorshowdemand"
  },
  {
    "type": "post",
    "url": "/demand/refreshDemand",
    "title": "1、 刷新需求",
    "group": "需求管理",
    "version": "1.0.0",
    "description": "<p>刷新需求</p>",
    "header": {
      "fields": {
        "Header": [
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "Authorization",
            "description": "<p>用户授权token</p>"
          }
        ]
      }
    },
    "parameter": {
      "fields": {
        "输入参数：": [
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "demand_id",
            "description": "<p>需求id</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/Demand.php",
    "groupTitle": "需求管理",
    "name": "PostDemandRefreshdemand"
  },
  {
    "type": "post",
    "url": "/index/collectUserInfo",
    "title": "24、 收集用户信息",
    "group": "首页",
    "version": "1.0.0",
    "description": "<p>收集用户信息</p>",
    "parameter": {
      "fields": {
        "输入参数：": [
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "name",
            "description": "<p>姓名</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "mobile",
            "description": "<p>电弧</p>"
          },
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "category_id",
            "description": "<p>类别id</p>"
          },
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "grade_id",
            "description": "<p>年级id</p>"
          },
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "subject_id",
            "description": "<p>科目id</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/Index.php",
    "groupTitle": "首页",
    "name": "PostIndexCollectuserinfo"
  },
  {
    "type": "post",
    "url": "/index/getAgreement",
    "title": "18、 获取各种协议",
    "group": "首页",
    "version": "1.0.0",
    "description": "<p>获取各种协议  user_agreement 用户协议  disclaimer 免责声明  privacy_agreement 隐私保护</p>",
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/Index.php",
    "groupTitle": "首页",
    "name": "PostIndexGetagreement"
  },
  {
    "type": "post",
    "url": "/index/getAreaList",
    "title": "15、 获取当前城市所有区域列表",
    "group": "首页",
    "version": "1.0.0",
    "description": "<p>获取当前城市所有区域列表</p>",
    "parameter": {
      "fields": {
        "输入参数：": [
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "city_id",
            "description": "<p>城市名称</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/Index.php",
    "groupTitle": "首页",
    "name": "PostIndexGetarealist"
  },
  {
    "type": "post",
    "url": "/index/getArticleList",
    "title": "19、 获取文章列表",
    "group": "首页",
    "version": "1.0.0",
    "description": "<p>获取文章列表</p>",
    "parameter": {
      "fields": {
        "输入参数：": [
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "class_id",
            "description": "<p>1 家庭教育, 2 学习方法, 3 教学资讯, 4 教学分享, 5 案例分享</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/Index.php",
    "groupTitle": "首页",
    "name": "PostIndexGetarticlelist"
  },
  {
    "type": "post",
    "url": "/index/getCategoryList",
    "title": "03、 获取分类列表",
    "group": "首页",
    "version": "1.0.0",
    "description": "<p>获取分类列表</p>",
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/Index.php",
    "groupTitle": "首页",
    "name": "PostIndexGetcategorylist"
  },
  {
    "type": "post",
    "url": "/index/getCityList",
    "title": "14、 根据省份获取城市列表",
    "group": "首页",
    "version": "1.0.0",
    "description": "<p>根据省份获取城市列表</p>",
    "parameter": {
      "fields": {
        "输入参数：": [
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "province_id",
            "description": "<p>省份id</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/Index.php",
    "groupTitle": "首页",
    "name": "PostIndexGetcitylist"
  },
  {
    "type": "post",
    "url": "/index/getDemandTeacherList",
    "title": "17、 查看申请获取老师列表",
    "group": "首页",
    "version": "1.0.0",
    "description": "<p>查看申请获取老师列表</p>",
    "parameter": {
      "fields": {
        "输入参数：": [
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "demand_id",
            "description": "<p>需求id</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/Index.php",
    "groupTitle": "首页",
    "name": "PostIndexGetdemandteacherlist"
  },
  {
    "type": "post",
    "url": "/index/getDownloadList",
    "title": "20、 获取下载列表",
    "group": "首页",
    "version": "1.0.0",
    "description": "<p>获取下载列表</p>",
    "parameter": {
      "fields": {
        "输入参数：": [
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "type",
            "description": "<p>资料下载(学生)|1|primary,课件下载(老师)|2|success</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/Index.php",
    "groupTitle": "首页",
    "name": "PostIndexGetdownloadlist"
  },
  {
    "type": "post",
    "url": "/index/getFaqList",
    "title": "22、 获取常见问题列表",
    "group": "首页",
    "version": "1.0.0",
    "description": "<p>获取下载列表</p>",
    "parameter": {
      "fields": {
        "输入参数：": [
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "faq_id",
            "description": "<p>热搜问题 id</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "keywords",
            "description": "<p>关键词</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/Index.php",
    "groupTitle": "首页",
    "name": "PostIndexGetfaqlist"
  },
  {
    "type": "post",
    "url": "/index/getGradeList",
    "title": "04、 获取年级列表",
    "group": "首页",
    "version": "1.0.0",
    "description": "<p>获取年级列表</p>",
    "parameter": {
      "fields": {
        "输入参数：": [
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "category_id",
            "description": "<p>分类id  不传为 所有的</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/Index.php",
    "groupTitle": "首页",
    "name": "PostIndexGetgradelist"
  },
  {
    "type": "post",
    "url": "/index/getGzhCode",
    "title": "23、 获取公众号/客服联系电话",
    "group": "首页",
    "version": "1.0.0",
    "description": "<p>获取公众号</p>",
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/Index.php",
    "groupTitle": "首页",
    "name": "PostIndexGetgzhcode"
  },
  {
    "type": "post",
    "url": "/index/getHomeInfo",
    "title": "02、 获取首页信息",
    "group": "首页",
    "version": "1.0.0",
    "description": "<p>获取首页信息</p>",
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/Index.php",
    "groupTitle": "首页",
    "name": "PostIndexGethomeinfo"
  },
  {
    "type": "post",
    "url": "/index/getHotCityAndProvinceList",
    "title": "13、 获取热门城市和省份列表",
    "group": "首页",
    "version": "1.0.0",
    "description": "<p>获取热门城市和省份列表</p>",
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/Index.php",
    "groupTitle": "首页",
    "name": "PostIndexGethotcityandprovincelist"
  },
  {
    "type": "post",
    "url": "/index/getHotFaqList",
    "title": "21、 获取常见问题热搜词",
    "group": "首页",
    "version": "1.0.0",
    "description": "<p>获取常见问题热搜词</p>",
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/Index.php",
    "groupTitle": "首页",
    "name": "PostIndexGethotfaqlist"
  },
  {
    "type": "post",
    "url": "/index/getServiceInfo",
    "title": "09、 获取客服详情",
    "group": "首页",
    "version": "1.0.0",
    "description": "<p>获取客服详情</p>",
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/Index.php",
    "groupTitle": "首页",
    "name": "PostIndexGetserviceinfo"
  },
  {
    "type": "post",
    "url": "/index/getSetMeal",
    "title": "16、 获取套餐",
    "group": "首页",
    "version": "1.0.0",
    "description": "<p>获取套餐</p>",
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/Index.php",
    "groupTitle": "首页",
    "name": "PostIndexGetsetmeal"
  },
  {
    "type": "post",
    "url": "/index/getStudentInfo",
    "title": "11、 获取学生信息",
    "group": "首页",
    "version": "1.0.0",
    "description": "<p>获取学生信息</p>",
    "header": {
      "fields": {
        "Header": [
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "Authorization",
            "description": "<p>用户授权token</p>"
          }
        ]
      }
    },
    "parameter": {
      "fields": {
        "传入参数：": [
          {
            "group": "传入参数：",
            "type": "number",
            "optional": false,
            "field": "mid",
            "description": "<p>会员id</p>"
          },
          {
            "group": "传入参数：",
            "type": "number",
            "optional": false,
            "field": "demand_id",
            "description": "<p>需求id</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/Index.php",
    "groupTitle": "首页",
    "name": "PostIndexGetstudentinfo"
  },
  {
    "type": "post",
    "url": "/index/getStudentList",
    "title": "10、 获取学生列表",
    "group": "首页",
    "version": "1.0.0",
    "description": "<p>获取学生列表</p>",
    "parameter": {
      "fields": {
        "输入参数：": [
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "limit",
            "description": "<p>数量</p>"
          },
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "page",
            "description": "<p>页数</p>"
          },
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "category_id",
            "description": "<p>分类id</p>"
          },
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "grade_id",
            "description": "<p>年级id</p>"
          },
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "subject_id",
            "description": "<p>科目id</p>"
          },
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "gender",
            "description": "<p>性别 男|1|success,女|2|warning</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "province",
            "description": "<p>任教省份</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "city",
            "description": "<p>任教城市</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "area",
            "description": "<p>任教区域</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "teaching_way",
            "description": "<p>任教方式  上门授课|1|primary,在线授课|2|success,均可|3|info</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "longitude",
            "description": "<p>经度</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "latitude",
            "description": "<p>纬度</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/Index.php",
    "groupTitle": "首页",
    "name": "PostIndexGetstudentlist"
  },
  {
    "type": "post",
    "url": "/index/getSubjectList",
    "title": "05、 获取学科列表",
    "group": "首页",
    "version": "1.0.0",
    "description": "<p>获取年级列表</p>",
    "parameter": {
      "fields": {
        "输入参数：": [
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "grade_id",
            "description": "<p>年级id  不传为 所有的</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/Index.php",
    "groupTitle": "首页",
    "name": "PostIndexGetsubjectlist"
  },
  {
    "type": "post",
    "url": "/index/getTeacherCommentList",
    "title": "08、 获取老师详情页评论列表",
    "group": "首页",
    "version": "1.0.0",
    "description": "<p>获取老师详情页评论列表</p>",
    "parameter": {
      "fields": {
        "输入参数：": [
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "limit",
            "description": "<p>数量</p>"
          },
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "page",
            "description": "<p>页数</p>"
          },
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "teacher_id",
            "description": "<p>老师id</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/Index.php",
    "groupTitle": "首页",
    "name": "PostIndexGetteachercommentlist"
  },
  {
    "type": "post",
    "url": "/index/getTeacherInfo",
    "title": "07、 获取老师详情",
    "group": "首页",
    "version": "1.0.0",
    "description": "<p>获取老师详情</p>",
    "parameter": {
      "fields": {
        "输入参数：": [
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "mid",
            "description": "<p>会员id</p>"
          },
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "teacher_id",
            "description": "<p>老师id</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/Index.php",
    "groupTitle": "首页",
    "name": "PostIndexGetteacherinfo"
  },
  {
    "type": "post",
    "url": "/index/getTeacherList",
    "title": "06、 获取老师列表",
    "group": "首页",
    "version": "1.0.0",
    "description": "<p>获取老师列表</p>",
    "parameter": {
      "fields": {
        "输入参数：": [
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "limit",
            "description": "<p>数量</p>"
          },
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "page",
            "description": "<p>页数</p>"
          },
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "category_id",
            "description": "<p>分类id</p>"
          },
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "grade_id",
            "description": "<p>年级id</p>"
          },
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "subject_id",
            "description": "<p>科目id</p>"
          },
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "gender",
            "description": "<p>性别 男|1|success,女|2|warning</p>"
          },
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "teacher_identity",
            "description": "<p>教师类别(身份)  大学生教员|1|primary,专职教员|2|success,不限|3|info</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "city",
            "description": "<p>任教城市</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "area",
            "description": "<p>任教区域</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "longitude",
            "description": "<p>经度</p>"
          },
          {
            "group": "输入参数：",
            "type": "string",
            "optional": false,
            "field": "latitude",
            "description": "<p>纬度</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/Index.php",
    "groupTitle": "首页",
    "name": "PostIndexGetteacherlist"
  },
  {
    "type": "post",
    "url": "/index/getToken",
    "title": "01、获取token",
    "group": "首页",
    "version": "1.0.0",
    "description": "<p>获取token</p>",
    "parameter": {
      "fields": {
        "输入参数：": [
          {
            "group": "输入参数：",
            "type": "number",
            "optional": false,
            "field": "id",
            "description": "<p>会员id</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/Index.php",
    "groupTitle": "首页",
    "name": "PostIndexGettoken"
  },
  {
    "type": "post",
    "url": "/index/qryIsLook",
    "title": "12、 查看是否可以查看学生信息",
    "group": "首页",
    "version": "1.0.0",
    "description": "<p>查看是否可以查看学生信息</p>",
    "header": {
      "fields": {
        "Header": [
          {
            "group": "Header",
            "type": "String",
            "optional": false,
            "field": "Authorization",
            "description": "<p>用户授权token</p>"
          }
        ]
      }
    },
    "parameter": {
      "fields": {
        "传入参数：": [
          {
            "group": "传入参数：",
            "type": "number",
            "optional": false,
            "field": "demand_id",
            "description": "<p>需求id</p>"
          }
        ]
      }
    },
    "filename": "/www/wwwroot/jiajiao.chenxi.plus/app/api/controller/Index.php",
    "groupTitle": "首页",
    "name": "PostIndexQryislook"
  }
] });
