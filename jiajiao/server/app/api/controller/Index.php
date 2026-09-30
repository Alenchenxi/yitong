<?php
namespace app\api\controller;

use app\admin\service\DemandViewRecordService;

class Index extends Common
{

    public function test()
    {
        $limit   = $this->request->param('limit', '10', 'intval');
        $page    = $this->request->param('page', 2, 'intval');
        $where[] = ['a.mid', '=', 9];
        $list    = db("demand")->alias('a')
            ->field('a.*,b.name as subject_name,c.name as grade_name')
            ->join('subject b', 'a.subject_id=b.subject_id', 'left')
            ->join('grade c', 'a.grade_id=c.grade_id', 'left')
            ->where($where)
            ->order('a.create_time desc')
            ->limit(($page - 1) * $limit, $limit)
            ->select()->toArray();
        foreach ($list as $k => $v) {

            $list[$k]['create_time'] = date('Y-m-d H:i:s', $list[$k]['create_time']);
        }
        dump($list);
    }
    public function index()
    {
        $title = config("config.site_title");
        $html  = <<<EOF
<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="X-UA-Compatible" content="IE=edge"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content=""><meta name="author" content=""><title>$title</title><style>        *{padding:0;margin:0}       html,body{height:100%;width:100%}header .header-content{text-align:center;padding:150px 0 50px;position:relative}@media(min-width:768px){header{min-height:100%}header .header-content{text-align:center;padding:0;height:100vh}header .header-content .header-content-inner{width:100%;margin:0;position:absolute;top:50%;transform:translateY(-50%)}}@media(min-width:992px){header .header-content .header-content-inner h1{font-size:80px}}header{position:relative;width:100%;height:100%;overflow-y:hidden;background:url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEMAAABkCAMAAADqvX3PAAAAKlBMVEUAAADX19fX19fBwcHT09PX19fW1tbT09PW1tbV1dXOzs7Ozs7BwcHV1dX5uIg2AAAADnRSTlMAPQAKH0czAAApFAAAAHys1goAAAHwSURBVHja7ZfdcuMwCEb1GUIDcd//dZuk2n5rZzCKOzuzFzo3+XNOBAIHtQosxwi0XUw/jjh2qN1pVzV43FJwJIDLuq5tvaNmzxeEZI5wWP/p9v0gypgGYhGH8fL28yyM7ycOJkFlJW3tZDHhRdBjIO22JR6a1BGMgTAWopvr6BC1jSB1MDWyXYfvkpDlg4iiV83lITiuoXZL+U4/ltcNq2MhogaYBWMYjYU8HHfSRdTrCIOLYImemrfz8dMO6DlVGYyFMWz3tmuGY6GgO1ikXVM51JDXurBO0nyEcyPTnvOXvmyb0hzqfV64jUUYw47Re9CZe6EbeC+M39+TcfK/gTFZuxZgOSag7aMASwGkrQW1Y2lLwXRMx3RMx3T8Pw67FpSOcA5RCccOcTMNL05aRw7Fn2kizA7+1VNH6ENAOBgOxiIK888dHPVqh+Q/yeknzQfHkhx+nqyjT0QFzDUd2Skp53lp7PdFnEkYIhzQv/KRzJUV0QdDSON5+S14CEW0vqSTiAPWWDknCLsY0BZxnNP0L/Z9YQEO8yznXZ2yNwfgTu7rNFgj9aamvS9eZljMTNOeoybSGNwQkvZ+3XrCU07t4HmWSBjDLBzEwdSzhMYcRPRZNYmgdjA1FyahcKQIqpKZs8N0TMd0TMd0/BvHF8n9f8tHo7HcAAAAAElFTkSuQmCC"),linear-gradient(to left,#9e218e,#434cbb);color:white}</style></head><body id="page-top"><header><div class="container"><div class="row"><div class="col-sm-12"><div class="header-content"><div class="header-content-inner"><h1>$title</h1></div></div></div></div></div></header>
<center><a href='https://beian.miit.gov.cn/' target="_blank">浙ICP备17046457号-4</a></center>
</body></html>
EOF;
        echo $html;
    }

    /**
     * @api {post} /index/getToken 01、获取token
     * @apiGroup 首页
     * @apiVersion 1.0.0
     * @apiDescription  获取token
     * @apiParam (输入参数：) {number}    id 会员id
     */
    public function getToken()
    {
        $token = $this->request->param('id', '', 'intval');
        return $this->setToken($token);
    }

    public function uploadImg()
    {
        if ($_POST['token'] != 'Vymn_xxjjwz/') {
            exit;
        }

        $str     = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890';
        $Uploads = 'Uploads/';
        $url     = 'Images/' . date("Y-m") . '/';
        if (! file_exists($Uploads . $url)) {
            mkdir($Uploads . $url);
        }

        switch ($_POST['type']) {
            case 1:
                $uploadImg = [];
                foreach ($_FILES as $pk => $v) {
                    $randStr  = str_shuffle($str);
                    $rands    = substr($randStr, 0, 8);
                    $filename = $rands . '.jpg';
                    $tmpname  = $v['tmp_name'];
                    $res      = move_uploaded_file($tmpname, $Uploads . $url . $filename);
                    if ($res) {
                        $uploadImg[$pk] = '/' . $url . $filename;
                    }

                }
                if ($_POST['img']) {
                    foreach ($_POST['img'] as $pk => $pf) {
                        $base64_image = str_replace(' ', '+', $pf);
                        if (preg_match('/^(data:\s*image\/(\w+);base64,)/', $base64_image, $result) && strlen($base64_image) <= 409600) {
                            $image_name     = uniqid() . ($result[2] == 'jpeg' ? '.jpg' : '.' . $result[2]);
                            $uploadImg[$pk] = '/' . $url . $image_name;
                            file_put_contents('.' . '/' . $Uploads . $url . $image_name, base64_decode(str_replace($result[1], '', $base64_image)));
                        }
                    }
                }

                $data = json_encode($uploadImg);
                break;
            case 2:
                file_put_contents('.' . '/' . $Uploads . 'Images/temp.png', $_POST['img']);
                break;
            default:
                $randStr  = str_shuffle($str);
                $rands    = substr($randStr, 0, 8);
                $filename = $rands . '.jpg';
                $tmpname  = $_FILES['file']['tmp_name'];
                $res      = move_uploaded_file($tmpname, $Uploads . $url . $filename);
                $data     = $res == true ? '/' . $Uploads . $url . $filename : '';
                $this->ystp($data);
        }
        echo $data;
    }

    private function ystp($sourceImage)
    {
        if (empty($sourceImage)) {
            return;
        }

        $sourceImage          = '.' . $sourceImage;
        $targetImage          = $sourceImage;
        $maxWidth             = 600;
        $maxHeight            = 600;
        list($width, $height) = getimagesize($sourceImage);
        if ($width > $maxWidth || $height > $maxHeight) {
            if ($width / $height >= $maxWidth / $maxHeight) {
                $newWidth  = $maxWidth;
                $newHeight = round(($maxWidth * $height) / $width);
            } else {
                $newHeight = $maxHeight;
                $newWidth  = round(($maxHeight * $width) / $height);
            }
            $image = \think\Image::open($sourceImage);
            $image->thumb($newWidth, $newHeight)->save($targetImage);
        }
        return;
    }
    /**
     * @api {post} /index/getHomeInfo 02、 获取首页信息
     * @apiGroup 首页
     * @apiVersion 1.0.0
     * @apiDescription  获取首页信息
     */
    public function getHomeInfo()
    {
        $area = $this->request->param('area', '', '');

        $slide_list = db('slide')->where('status', 1)->select()->toArray();

        $notice_list = db('notice')->select()->toArray();

        if ($area) {
            $where[] = ['a.area', 'find in set', $area];
        }
        // $teacher_list = db("teacher")->alias('a')
        //     ->field('a.*,b.nickname,b.avatar,b.login_time')
        //     ->join('member b', 'a.mid=b.mid', 'left')
        //     ->where($where)
        //     ->order('a.stick_time desc,a.refresh_time desc,a.teacher_id desc')
        //     ->limit(10)
        //     ->select()->toArray();

        foreach ($slide_list as $k => $v) {
            $slide_list[$k]['detail'] = format_html($slide_list[$k]['detail']);
        }

        $data['slide_list'] = $slide_list;
        // $data['teacher_list'] = $teacher_list;
        $data['notice_list'] = $notice_list;

        return json(['status' => 200, 'data' => $data]);
    }

    /**
     * @api {post} /index/getBannerInfo 02、 获取轮播图详情
     * @apiGroup 首页
     * @apiVersion 1.0.0
     * @apiDescription  获取轮播图详情
     * @apiParam (输入参数：) {number}      id  轮播图片id
     */
    public function getBannerInfo()
    {
        $id = $this->request->param('id', '', '');

        $where[] = ['id', '=', $id];

        $info           = db("slide")->where($where)->find();
        $info['detail'] = format_html($info['detail']);
        return json(['status' => 200, 'data' => $info]);
    }

    /**
     * @api {post} /index/getCategoryList 03、 获取分类列表
     * @apiGroup 首页
     * @apiVersion 1.0.0
     * @apiDescription  获取分类列表
     */
    public function getCategoryList()
    {
        $list = db("category")->order('zsort asc')->select()->toArray();

        return json(['status' => 200, 'data' => $list]);
    }

    /**
     * @api {post} /index/getCategoryCascadeList 03-1、 获取分类-年级-学科级联列表
     * @apiGroup 首页
     * @apiVersion 1.0.0
     * @apiDescription  获取分类-年级-学科三级级联列表
     */
    public function getCategoryCascadeList()
    {
        // 第一步：获取分类列表
        $categoryList = db("category")->order('zsort asc')->select()->toArray();

        // 第二步：遍历分类列表，获取每个分类下的年级列表
        foreach ($categoryList as $ck => $category) {
            $gradeList = db("grade")->alias('a')
                ->field('a.*,b.name as category_name')
                ->join('category b', 'a.category_id=b.category_id', 'left')
                ->where('a.category_id', $category['category_id'])
                ->order('b.zsort asc,a.zsort asc')
                ->select()->toArray();

            // 第三步：遍历年级列表，获取每个年级下的学科列表
            foreach ($gradeList as $gk => $grade) {
                $subjectList = db("subject")->alias('a')
                    ->field('a.*,b.name as grade_name,c.name as category_name')
                    ->join('grade b', 'a.grade_id=b.grade_id', 'left')
                    ->join('category c', 'b.category_id=c.category_id', 'left')
                    ->where('a.grade_id', $grade['grade_id'])
                    ->order('b.zsort asc,a.zsort asc')
                    ->select()->toArray();

                // 第三级字段映射：subject_id -> value, name -> label
                $subjectList = array_map(function ($item) {
                    $item['value'] = $item['subject_id'];
                    $item['label'] = $item['name'];
                    return $item;
                }, $subjectList);

                $gradeList[$gk]['value']    = $grade['grade_id'];
                $gradeList[$gk]['label']    = $grade['name'];
                $gradeList[$gk]['children'] = $subjectList;
            }

            $categoryList[$ck]['value']    = $category['category_id'];
            $categoryList[$ck]['label']    = $category['name'];
            $categoryList[$ck]['children'] = $gradeList;
        }

        return json(['status' => 200, 'data' => $categoryList]);
    }

    /**
     * @api {post} /index/getGradeList 04、 获取年级列表
     * @apiGroup 首页
     * @apiVersion 1.0.0
     * @apiDescription  获取年级列表
     * @apiParam (输入参数：) {number}      category_id 分类id  不传为 所有的
     */
    public function getGradeList()
    {
        $category_id = $this->request->param('category_id', '', 'intval');

        $where = [];
        if ($category_id) {
            $where[] = ['a.category_id', '=', $category_id];
        }

        $list = db("grade")->alias('a')
            ->field('a.*,b.name as category_name')
            ->join('category b', 'a.category_id=b.category_id', 'left')
            ->where($where)
            ->order('b.zsort asc,a.zsort asc')
            ->select()->toArray();

        return json(['status' => 200, 'data' => $list]);
    }

    /**
     * @api {post} /index/getSubjectList 05、 获取学科列表
     * @apiGroup 首页
     * @apiVersion 1.0.0
     * @apiDescription  获取年级列表
     * @apiParam (输入参数：) {number}      grade_id 年级id  不传为 所有的
     */
    public function getSubjectList()
    {
        $grade_id = $this->request->param('grade_id', '', 'intval');

        $where = [];
        if ($grade_id) {
            $where[] = ['a.grade_id', '=', $grade_id];
        }

        $list = db("subject")->alias('a')
            ->field('a.*,b.name as grade_name,c.name as category_name')
            ->join('grade b', 'a.grade_id=b.grade_id', 'left')
            ->join('category c', 'b.category_id=c.category_id', 'left')
            ->where($where)
            ->order('b.zsort asc,a.zsort asc')
            ->select()->toArray();

        return json(['status' => 200, 'data' => $list]);
    }

    /**
     * @api {post} /index/getTeacherList 06、 获取老师列表
     * @apiGroup 首页
     * @apiVersion 1.0.0
     * @apiDescription  获取老师列表
     * @apiParam (输入参数：) {number}      limit 数量
     * @apiParam (输入参数：) {number}      page 页数
     * @apiParam (输入参数：) {number}      category_id     分类id
     * @apiParam (输入参数：) {number}      grade_id     年级id
     * @apiParam (输入参数：) {number}      subject_id     科目id
     * @apiParam (输入参数：) {number}      gender     性别 男|1|success,女|2|warning
     * @apiParam (输入参数：) {number}      teacher_identity     教师类别(身份)  大学生教员|1|primary,专职教员|2|success,不限|3|info
     * @apiParam (输入参数：) {string}      province 省
     * @apiParam (输入参数：) {string}      city 任教城市
     * @apiParam (输入参数：) {string}      area 任教区域
     * @apiParam (输入参数：) {string}      longitude 经度
     * @apiParam (输入参数：) {string}      latitude 纬度
     * @apiParam (输入参数：) {string}      keyword 关键词
     */
    public function getTeacherList()
    {
        $limit            = $this->request->param('limit', '10', 'intval');
        $page             = $this->request->param('page', 1, 'intval');
        $gender           = $this->request->param('gender', '', '');
        $category_id      = $this->request->param('category_id', '', '');
        $grade_id         = $this->request->param('grade_id', '', '');
        $subject_id       = $this->request->param('subject_id', '', '');
        $subject_name     = $this->request->param('subject_name', '', '');
        $teacher_identity = $this->request->param('teacher_identity', '', '');
        $province         = $this->request->param('province', '', '');
        $city             = $this->request->param('city', '', '');
        $area             = $this->request->param('area', '', '');
        $longitude        = $this->request->param('longitude', '', '');
        $latitude         = $this->request->param('latitude', '', '');
        $keyword          = $this->request->param('keyword', '', '');

        if (! $longitude || ! $latitude) {
            return json(['status' => 404, 'msg' => '请获取当前位置']);
        }

        if ($keyword) {
            $subject_ids = db('subject')->where("name like '$keyword'")->column('subject_id');

            if ($subject_ids) {
                $where1[] = ['subject_id', 'in', $subject_ids];

                $teacher_ids = db('teaching_subject')->where($where1)->group('teacher_id')->column('teacher_id');
                $where[]     = ['a.teacher_id', 'in', $teacher_ids];
            } else {
                if (is_numeric($keyword)) {
                    $where[] = ['a.teacher_id', '=', $keyword];
                }else{
                    $where[] = ['a.name', 'like', "%{$keyword}%"];
                }
            }

        }

        if ($grade_id) {
            $where[] = ['b.category_id', '=', $category_id];
        }

        if ($grade_id) {
            $where[] = ['b.grade_id', '=', $grade_id];
        }

        if ($subject_id) {
            $where[] = ['b.subject_id', '=', $subject_id];
        }

        if ($subject_name) {
            $subject_ids = db('subject')->where("name like '$subject_name'")->column('subject_id');
            $where2[]    = ['subject_id', 'in', $subject_ids];

            $teacher_ids = db('teaching_subject')->where($where2)->group('teacher_id')->column('teacher_id');
            $where[]     = ['a.teacher_id', 'in', $teacher_ids];
        }

        if ($gender) {
            $where[] = ['a.gender', '=', $gender];
        }

        if ($teacher_identity) {
            $where[] = ['a.teacher_identity', '=', $teacher_identity];
        }

        if ($province) {
            $where[] = ['a.province', 'like', "$province"];
        }

        if ($city) {
            $where[] = ['a.city', 'like', "$city"];
        }

        if ($area) {
            $where[] = ['a.area', 'find in set', $area];
        }

        //获取 为隐藏简历的
        $where[] = ['a.is_hide', '=', 0];
        $where[] = ['a.status', '=', 1];
        $where[] = ['a.is_on_off', '=', 1];

        $list = db("teacher")->alias('a')
            ->field("a.age,a.school,a.teacher_id,a.star_level,a.head_img,a.name,a.teacher_identity,a.gender,a.teaching_age,a.school,a.label,a.birthday,a.id_number,
	(
		6371 * acos(
			cos( radians( $latitude ) ) * cos( radians( a.latitude ) ) * cos(
				radians( a.longitude ) - radians( $longitude )
			) + sin( radians( $latitude ) ) * sin( radians( a.latitude ) )
		)
	) AS distance")
            ->where($where)
            ->order('a.stick_time desc,a.refresh_time desc,distance asc,a.teacher_id desc')
            ->limit(($page - 1) * $limit, $limit)
            ->select()->toArray();

        foreach ($list as $k => $v) {
            $main_subject = db('teaching_subject')->where('teacher_id', $v['teacher_id'])->where('is_main', 1)->find();
            if (! $main_subject) {
                $main_subject = db('teaching_subject')->where('teacher_id', $v['teacher_id'])->find();
            }

            $min_subject = db('teaching_subject')->where('teacher_id', $v['teacher_id'])->order('price asc')->find();

            $list[$k]['category_name'] = $main_subject['category_name'];
            $list[$k]['grade_name']    = $main_subject['grade_name'];
            $list[$k]['subject_name']  = $main_subject['subject_name'];
            $list[$k]['min_price']     = $min_subject['price'];
            $list[$k]['mobile']        = '';
            if($v['birthday']){
                $list[$k]['age'] = getAgeFromBirthday($v['birthday']);
            }elseif($v['id_number']){
                $list[$k]['age'] = getAgeFromIdNo($v['id_number']);
            }
        }

        return json(['status' => 200, 'data' => $list]);
    }

    /**
     * @api {post} /index/getTeacherInfo 07、 获取老师详情
     * @apiGroup 首页
     * @apiVersion 1.0.0
     * @apiDescription  获取老师详情
     * @apiParam (输入参数：) {number}      mid     会员id
     * @apiParam (输入参数：) {number}      teacher_id     老师id
     */
    public function getTeacherInfo()
    {
        /*if (!request()->uid) {
			        return json(['status' => 404, 'msg' => "登陆超时"]);
		*/
        $teacher_id = $this->request->param('teacher_id', '', 'intval');
        $mid        = $this->request->param('mid', '', 'intval');

        if (!$teacher_id && !$mid) {
            return json(['status' => 404, 'msg' => '参数不完整']);
        }

        $where[] = $teacher_id ? ['teacher_id', '=', $teacher_id] : ['mid', '=', $mid];
        $info    = db("teacher")->where($where)->find();
        // $info['age'] = 1;
        if($info['birthday']){
                $info['age'] = getAgeFromBirthday($info['birthday']);
        }elseif($info['id_number']){
            $info['age'] = getAgeFromIdNo($info['id_number']);
        }
        if($info['career_year'] && !$info['teaching_age']){
            $info['teaching_age'] = getTeacherAge($info['career_year']);
        }
        if(!$info['career_year'] && !is_null($info['teaching_age'])){
            $info['career_year'] = date('Y') - $info['teaching_age'];
        }
        //当前用户是否关注老师
        $info['is_collect'] = 0;
        //是否显示老师详情
        $info['is_check'] = 0;
        if ($mid) {
            $info['has_session'] = 1; //登录
            //判断当前用户是否 收藏该老师  is_collect 0未收藏  1已收藏
            $has = db("collect")->where('mid', $mid)->where('teacher_id', $teacher_id)->find();
            if ($has) {
                $info['is_collect'] = 1;
            }

            //判断当前用户是否 购买该老师课程  is_check 0未购买 不可查看联系方式  1已购买 可查看
            $has_order = db("order")->where('mid', $mid)->where('teacher_id', $teacher_id)->where('status', '<>', 0)->find();
            if ($has_order) {
                $info['is_check'] = 1;
            }

            //判断是否联系过
            $contact_history = db("contact_history")->where('mid', $mid)->where('teacher_id', $teacher_id)->find();
            if ($contact_history) {
                $info['is_contact'] = 1;
            }
            //用户剩余可联系次数
            $info['user_dial_num'] = db("member")->where('mid', $mid)->value("dial_num");

            //检查dial_order表中是否有30天以内的记录
            $info['is_vip'] = db("dial_order")->where('mid', $mid)->where('pay_time', '>', time() - 30 * 86400)->where('status', 1)->count();
        }else{
            $info['is_vip'] = 0;
            $info['has_session'] = 0; //没有登录
        }

        //处理图片
        if ($info['photos']) {
            $pics = json_decode(html_out($info['photos']), true);

            $pics_list = [];
            foreach ($pics as $key => $value) {
                $pics_list[] = $value['url'];
            }
            $info['photos'] = $pics_list;
        }

        //处理图片
        if ($info['honor_img']) {
            $pics = json_decode(html_out($info['honor_img']), true);

            $pics_list = [];
            foreach ($pics as $key => $value) {
                $pics_list[] = $value['url'];
            }
            $info['honor_img'] = $pics_list;
        }

        //老师教授科目
        $info['teaching_subject'] = db('teaching_subject')->where('teacher_id', $info['teacher_id'])->select()->toArray();
        //老师教授科目
        $info['schooltime'] = db('schooltime')->where('teacher_id', $info['teacher_id'])->select()->toArray();
        //老师教学经历
        $info['experience'] = db('experience')->where('teacher_id', $info['teacher_id'])->select()->toArray();
        $info['experience'][0]['experience'] = $info['introduction'];

        $info['dial_price'] = config('config.dial_price');
        $info['dial_num']   = config('config.dial_num');
        $info['dial_text']   = config('config.dial_text');
        if (!$info['dial_text']) {
            $info['dial_text'] = '支付' . $info['dial_price'] . '元可以联系' . $info['dial_num'] . '个老师，收藏20位老师，这笔钱可以抵扣课时费';
        }

        //评论列表
        $comment_list = db('comment')->alias('a')
            ->field('a.*,b.nickname,b.avatar')
            ->join('member b', 'a.mid=b.mid', 'left')
            ->where('a.teacher_id', $teacher_id)
            ->select()->toArray();
        $info['comment_list'] = $comment_list;
        // unset($info['email']);
        if ($info['is_contact'] != 1) {
            // unset($info['mobile']);
        }
        return json(['status' => 200, 'data' => $info]);
    }

    /**
     * @api {post} /index/getTeacherCommentList 08、 获取老师详情页评论列表
     * @apiGroup 首页
     * @apiVersion 1.0.0
     * @apiDescription  获取老师详情页评论列表
     * @apiParam (输入参数：) {number}      limit 数量
     * @apiParam (输入参数：) {number}      page 页数
     * @apiParam (输入参数：) {number}      teacher_id     老师id
     */
    public function getTeacherCommentList()
    {
        $limit      = $this->request->param('limit', '', 'intval') ? $this->request->param('limit', '', 'intval') : 10;
        $page       = $this->request->param('page', '', 'intval') ? $this->request->param('page', '', 'intval') : 1;
        $teacher_id = $this->request->param('teacher_id', '', 'intval');

        if (! $teacher_id) {
            return json(['status' => 404, 'msg' => '参数不完整']);
        }

        /*$list = db('demand')->alias('a')
			        ->field('b.*,c.nickname,c.avatar,d.name as subject_name')
			        ->join('comment b','a.demand_id=b.demand_id','left')
			        ->join('member c','b.mid=c.mid','left')
			        ->join('subject d','a.subject_id=d.subject_id','left')
			        ->where('a.teacher_id',$teacher_id)
			        ->where('b.sup_comment_id',0)
			        ->order('b.stick_time desc,b.create_time desc')
			        ->limit(($page - 1) * $limit, $limit)
		*/

        //print_r($list);
        $list = db('comment')->alias('a')
            ->field('a.*,b.nickname,b.avatar')
            ->join('member b', 'a.mid=b.mid', 'left')
            ->where('a.teacher_id', $teacher_id)
            ->where('a.sup_comment_id', 0)
            ->order('a.stick_time desc,a.create_time desc')
            ->limit(($page - 1) * $limit, $limit)
            ->select()->toArray();

        foreach ($list as $k => $v) {
            $list[$k]['create_time'] = date('Y-m-d', $list[$k]['create_time']);

            if (! $list[$k]['content']) {
                $list[$k]['content'] = '该学员暂未评论';
            }

            $pics      = json_decode(html_out($v['pics']), true);
            $pics_list = [];
            foreach ($pics as $key => $value) {
                $pics_list[] = $value['url'];
            }
            $list[$k]['pics'] = $pics_list;

            $comment_lists = db('comment')->alias('a')
                ->field('a.*,b.nickname,b.avatar,d.name as subject_name')
                ->join('member b', 'a.mid=b.mid', 'left')
                ->join('demand c', 'a.demand_id=c.demand_id', 'left')
                ->join('subject d', 'c.subject_id=d.subject_id', 'left')
                ->where('a.sup_comment_id', $v['comment_id'])
                ->order('a.stick_time desc,a.create_time desc')
                ->select()->toArray();

            foreach ($comment_lists as $ck => $cv) {
                $cpics      = json_decode(html_out($cv['pics']), true);
                $cpics_list = [];
                foreach ($cpics as $ckey => $cvalue) {
                    $cpics_list[] = $cvalue['url'];
                }
                $comment_lists[$ck]['pics']        = $cpics_list;
                $comment_lists[$ck]['create_time'] = date('Y-m-d', $cv['create_time']);
            }

            $list[$k]['list'] = $comment_lists;
        }

        /*$count = count($list);
			        $bc_list = [];
			        if($page==1 && $count<10){
			        $all_liat = db('demand')->alias('a')
			        ->field('b.*,c.nickname,c.avatar,a.create_time,d.name as subject_name')
			        ->join('comment b','a.demand_id=b.demand_id','left')
			        ->join('member c','a.mid=c.mid','left')
			        ->join('subject d','a.subject_id=d.subject_id','left')
			        ->where('a.teacher_id',$teacher_id)
			        ->select()->toArray();

			        foreach ($all_liat as $k=>$v){
			        if(!$v['comment_id']){
			        $v['create_time'] = date('Y-m-d',$v['create_time']);
			        $v['content'] = '该用户暂未评论';
			        $bc_list[] = $v;
			        }
			        }
			        }

		*/

        return json(['status' => 200, 'data' => $list]);
    }

    /**
     * @api {post} /index/getServiceInfo 09、 获取客服详情
     * @apiGroup 首页
     * @apiVersion 1.0.0
     * @apiDescription  获取客服详情
     */
    public function getServiceInfo()
    {

        $qr_code = config('config.service_qr_code');
        $mobile  = config('config.service_mobile');

        $service_info['qr_code'] = $qr_code;
        $service_info['mobile']  = $mobile;

        return json(['status' => 200, 'data' => $service_info]);
    }

    /**
     * @api {post} /index/getStudentList 10、 获取学生列表
     * @apiGroup 首页
     * @apiVersion 1.0.0
     * @apiDescription  获取学生列表
     * @apiParam (输入参数：) {number}      limit 数量
     * @apiParam (输入参数：) {number}      page 页数
     * @apiParam (输入参数：) {number}      category_id     分类id
     * @apiParam (输入参数：) {number}      grade_id     年级id
     * @apiParam (输入参数：) {number}      subject_id     科目id
     * @apiParam (输入参数：) {number}      gender     性别 男|1|success,女|2|warning
     * @apiParam (输入参数：) {string}      province 任教省份
     * @apiParam (输入参数：) {string}      city 任教城市
     * @apiParam (输入参数：) {string}      area 任教区域
     * @apiParam (输入参数：) {string}      teaching_way 任教方式  上门授课|1|primary,在线授课|2|success,均可|3|info
     * @apiParam (输入参数：) {string}      longitude 经度
     * @apiParam (输入参数：) {string}      latitude 纬度
     */
    public function getStudentList()
    {
        $limit            = $this->request->param('limit', '10', 'intval');
        $page             = $this->request->param('page', 1, 'intval');
        $category_id      = $this->request->param('category_id', '', '');
        $grade_id         = $this->request->param('grade_id', '', '');
        $subject_id       = $this->request->param('subject_id', '', '');
        $subject_name     = $this->request->param('subject_name', '', '');
        $gender           = $this->request->param('gender', '', '');
        $province         = $this->request->param('province', '', '');
        $city             = $this->request->param('city', '', '');
        $area             = $this->request->param('area', '', '');
        $teaching_way     = $this->request->param('teaching_way', '', '');
        $longitude        = $this->request->param('longitude', '', '');
        $latitude         = $this->request->param('latitude', '', '');
        $teacher_identity = $this->request->param('teacher_identity', '', '');
        $keyword          = $this->request->param('keyword', '', '');

        if (! $longitude || ! $latitude) {
            return json(['status' => 404, 'msg' => '请获取当前位置']);
        }

        if ($category_id) {
            $where[] = ['a.category_id', '=', $category_id];
        }
        if ($grade_id) {
            $where[] = ['a.grade_id', '=', $grade_id];
        }
        if ($subject_id) {
            $where[] = ['a.subject_id', '=', $subject_id];
        }

        if ($subject_name) {
            $subject_ids = db('subject')->where("name like '$subject_name'")->column('subject_id');
            $where[]     = ['a.subject_id', 'in', $subject_ids];
        }

        if ($teacher_identity) {
            $where[] = ['a.teacher_identity', 'in', [$teacher_identity, 3]];
        }

        if ($gender) {
            $where[] = ['a.gender', '=', $gender];
        }
        if ($province) {
            $where[] = ['a.province', 'like', "$province%"];
        }
        if ($city) {
            $where[] = ['a.city', 'like', "$city%"];
        }
        if ($area) {
            $where[] = ['a.area', 'like', "$area%"];
        }
        if ($teaching_way && $teaching_way != 3) {
            $where[] = ['a.teaching_way', '=', $teaching_way];
        }

        if ($keyword) {
            $subject_ids = db('subject')->where("name like '$keyword'")->column('subject_id');

            if ($subject_ids) {
                $where1[] = ['subject_id', 'in', $subject_ids];

                $teacher_ids = db('teaching_subject')->where($where1)->group('teacher_id')->column('teacher_id');
                $where[]     = ['a.teacher_id', 'in', $teacher_ids];
            } else {
                if (is_numeric($keyword)) {
                    $where[] = function($query) use ($keyword) {
                        $query->where('a.demand_id', '=', $keyword)
                              ->whereOr('a.ext_no', 'like', "%{$keyword}%");
                    };
                }else{
                    $where[] = ['a.ext_no', 'like', "%{$keyword}%"];
                }
            }

        }

        $where[] = ['a.status', '=', 1];

        $list = db("demand")->alias('a')
            ->field("a.demand_id,a.mid,a.province,a.city,a.area,a.teaching_way,a.address,a.kefu_direct, b.name as subject_name,c.name as grade_name,
	(
		6371 * acos(
			cos( radians( $latitude ) ) * cos( radians( a.latitude ) ) * cos(
				radians( a.longitude ) - radians( $longitude )
			) + sin( radians( $latitude ) ) * sin( radians( a.latitude ) )
		)
	) AS distance")
        //->field('a.*,b.name as subject_name,c.name as grade_name')
            ->join('subject b', 'a.subject_id=b.subject_id', 'left')
            ->join('grade c', 'a.grade_id=c.grade_id', 'left')
            ->where($where)
            ->order('a.stick_time desc,distance asc,a.demand_id desc')
            ->limit(($page - 1) * $limit, $limit)
            ->select()->toArray();

        foreach ($list as $k => $v) {
            $list[$k]['create_time'] = date('Y-m-d H:i:s', $list[$k]['create_time']);
            $list[$k]['mid']         = $v['demand_id'];
        }

        return json(['status' => 200, 'data' => $list]);
    }

    /**
     * @api {post} /index/getStudentInfo 11、 获取学生信息
     * @apiGroup 首页
     * @apiVersion 1.0.0
     * @apiDescription  获取学生信息
     * @apiHeader {String} Authorization 用户授权token
     * @apiParam (传入参数：) {number}      mid   会员id
     * @apiParam (传入参数：) {number}      demand_id   需求id
     * @apiParam (传入参数：) {number}      add_record   bool是否记录
     */
    public function getStudentInfo()
    {

        $mid       = $this->request->param('mid', '', 'intval');
        $demand_id = $this->request->param('demand_id', '', 'intval');  
        $add_record    = $this->request->param('add_record', '0', 'intval');
        if (! $demand_id) {
            return json(['status' => 404, 'msg' => '参数不完整']);
        }

        //查询学生信息
        $demand_info = db('demand')->where('demand_id', $demand_id)->find();
        if (! $demand_info) {
            return json(['status' => 404, 'msg' => '对不起,没有找该学员信息']);
        }

        $info = db("demand")->alias('a')
            ->field('a.*,b.name as subject_name,c.name as grade_name,d.name as category_name')
            ->join('subject b', 'a.subject_id=b.subject_id', 'left')
            ->join('grade c', 'a.grade_id=c.grade_id', 'left')
            ->join('category d', 'a.category_id=d.category_id', 'left')
            ->where('a.demand_id', $demand_id)
            ->find();

        $info['create_time'] = date('Y-m-d', $info['create_time']);
        $info['is_contact']  = 0;
        //老师教授科目
        $info['schooltime'] = db('schooltime')->where('demand_id', $info['demand_id'])->select()->toArray();
        $teacher_cost_vip = config("config.teacher_cost_vip");
        $info['teacher_cost_vip'] = $teacher_cost_vip;
        if ($mid) {
            //是否开启vip模式 1开启，0未开启
            if ($teacher_cost_vip == 1){
                $vip_info = db('member_vip')->where('mid', $mid)->find();
                if ($vip_info){
                    $info['eff_to'] = date('Y-m-d', $vip_info['eff_to']);
                }
                if ($vip_info && $vip_info['eff_to'] >= time()) {
                  $info['is_contact'] = 1;
                }
            }else{
                $has2 = db('teacher_order')->where('mid', $mid)->where('demand_id', $demand_id)->where("status", 1)->find();
                if ($has2) {
                  $info['is_contact'] = 1;
                }
            }
        }
        if($info['agent'] === 1){
            $info['mobile'] = $info['agent_phone'];
        }
        unset($info['email']);
        if (!$info['is_contact'] || $info['hide_mobile']) {
            unset($info['mobile']);
        }
        if ($teacher_cost_vip == 1){
            $info['teacher_price'] = config('config.teacher_vip_price');
        }else{
            $info['teacher_price'] = config('config.teacher_price');
        }

        //记录日志
        if($add_record == 1){
            $teacher_info = db('teacher')->where('mid', $mid)->find();
            $teacher_id = $teacher_info ? $teacher_info['teacher_id'] : 0;
            DemandViewRecordService::addDemandViewRecord($demand_info, $mid, $teacher_id);
        }
        
        return json(['status' => 200, 'data' => $info]);
    }

    /**
     * @api {post} /index/qryIsLook 12、 查看是否可以查看学生信息
     * @apiGroup 首页
     * @apiVersion 1.0.0
     * @apiDescription  查看是否可以查看学生信息
     * @apiHeader {String} Authorization 用户授权token
     * @apiParam (传入参数：) {number}      demand_id   需求id
     */
    public function qryIsLook()
    {
        if (! request()->uid) {
            return json(['status' => 404, 'msg' => "登陆超时"]);
        }
        $demand_id = $this->request->param('demand_id', '', 'intval');
        if (! $demand_id) {
            return json(['status' => 404, 'msg' => '参数不完整']);
        }

        //查询 该用户 老师信息
        $teacher_info = db('teacher')->where('mid', request()->uid)->find();
        if (! $teacher_info) {
            return json(['status' => 404, 'msg' => '对不起,没有找到您的老师信息']);
        }

        //查询学生信息
        $demand_info = db('demand')->where('demand_id', $demand_id)->find();
        if (! $demand_info) {
            return json(['status' => 404, 'msg' => '对不起,没有找该学员信息']);
        }

        $has = db('teacher_stu')->where('teacher_id', $teacher_info['teacher_id'])->where('demand_id', $demand_id)->where('status', 1)->find();

        //is_contact  0不可以联系   1可以联系
        $is_contact = 0;
        if ($has) {
            $is_contact = 1;
        }

        return json(['status' => 200, 'data' => $is_contact]);
    }

    /**
     * @api {post} /index/getHotCityAndProvinceList 13、 获取热门城市和省份列表
     * @apiGroup 首页
     * @apiVersion 1.0.0
     * @apiDescription  获取热门城市和省份列表
     */
    public function getHotCityAndProvinceList()
    {
        //获取热门城市
        $hot_city_list = db('area')->where("is_hot", 1)->order('id asc')->select()->toArray();
        //获取省列表
        $province_list = db("area")->where('parentid', 0)->order('listorder asc')->select()->toArray();

        $data['hot_city_list'] = $hot_city_list;
        $data['province_list'] = $province_list;

        return json(['status' => 200, 'data' => $data]);
    }

    /**
     * @api {post} /index/getCityCascade 13-1、 获取省市两级级联列表
     * @apiGroup 首页
     * @apiVersion 1.0.0
     * @apiDescription  获取省市两级级联列表
     */
    public function getCityCascade()
    {
        // 获取省列表
        $province_list = db("area")->where('parentid', 0)->order('listorder asc')->select()->toArray();

        // 遍历省列表，获取每个省下的城市列表
        foreach ($province_list as $pk => $province) {
            $city_list = db("area")->where('parentid', $province['id'])->select()->toArray();
            $province_list[$pk]['children'] = $city_list;
        }

        return json(['status' => 200, 'data' => $province_list]);
    }

    /**
     * @api {post} /index/getCityList 14、 根据省份获取城市列表
     * @apiGroup 首页
     * @apiVersion 1.0.0
     * @apiDescription  根据省份获取城市列表
     * @apiParam (输入参数：) {string}      province_id 省份id
     */
    public function getCityList()
    {
        $province_id = $this->request->param('province_id', '', '');

        if (! $province_id) {
            return json(['status' => 404, 'msg' => '参数不完整']);
        }

        //获取城市列表
        $list = db("area")->where('parentid', $province_id)->select()->toArray();
        return json(['status' => 200, 'data' => $list]);
    }

    /**
     * @api {post} /index/getAreaList 15、 获取当前城市所有区域列表
     * @apiGroup 首页
     * @apiVersion 1.0.0
     * @apiDescription  获取当前城市所有区域列表
     * @apiParam (输入参数：) {string}      city_id 城市名称
     */
    public function getAreaList()
    {
        $city_id = $this->request->param('city_id', '', '');

        if (! $city_id) {
            return json(['status' => 404, 'msg' => '参数不完整']);
        }

        $list = db("area")->where('parentid', $city_id)->select()->toArray();

        return json(['status' => 200, 'data' => $list]);
    }

    /**
     * @api {post} /index/getSetMeal 16、 获取套餐
     * @apiGroup 首页
     * @apiVersion 1.0.0
     * @apiDescription  获取套餐
     */
    public function getSetMeal()
    {
        $list = db('set_meal')->select()->toArray();
        return json(['status' => 200, 'data' => $list]);
    }

    /**
     * @api {post} /index/getDemandTeacherList 17、 查看申请获取老师列表
     * @apiGroup 首页
     * @apiVersion 1.0.0
     * @apiDescription  查看申请获取老师列表
     * @apiParam (输入参数：) {number}      demand_id  需求id
     */
    public function getDemandTeacherList()
    {
        $demand_id = $this->request->param('demand_id', '', 'intval');

        if (! $demand_id) {
            return json(['status' => 404, 'msg' => '参数不完整']);
        }

        $teacher_ids = db('order')->where('demand_id', $demand_id)->where('status in (1,4)')->column('teacher_id');

        $where[] = ['a.teacher_id', 'in', $teacher_ids];
        $where[] = ['a.is_hide', '=', 0];
        $where[] = ['a.status', '=', 1];
        $where[] = ['a.is_on_off', '=', 1];

        $list = db("teacher")->alias('a')
            ->field('a.*,b.nickname,b.avatar,b.login_time')
            ->join('member b', 'a.mid=b.mid', 'left')
            ->where($where)
            ->order('a.stick_time desc,a.refresh_time desc,a.teacher_id desc')
            ->select()->toArray();

        foreach ($list as $k => $v) {
            $list[$k]['name']       = getShortName($list[$k]['name']);
            $list[$k]['login_time'] = time_tran($list[$k]['login_time']);

            $subject_id                = explode(',', $v['subject_id']);
            $where1                    = [];
            $where1[]                  = ['subject_id', 'in', $subject_id];
            $list[$k]['subject_names'] = db('subject')->where($where1)->limit(3)->select()->toArray();
        }

        return json(['status' => 200, 'data' => $list]);
    }

    /**
     * @api {post} /index/getAgreement 18、 获取各种协议
     * @apiGroup 首页
     * @apiVersion 1.0.0
     * @apiDescription  获取各种协议  user_agreement 用户协议  disclaimer 免责声明  privacy_agreement 隐私保护
     */
    public function getAgreement()
    {
        $data['user_agreement']    = format_html(config("config.user_agreement"));
        $data['disclaimer']        = format_html(config("config.disclaimer"));
        $data['privacy_agreement'] = format_html(config("config.privacy_agreement"));
        $data['take_order_sm']     = format_html(config("config.take_order_sm"));
        return json(['status' => 200, 'data' => $data]);
    }

    public function getAgreement4()
    {
        $data = format_html(config("config.jiaoyuan_xieyi"));
        return json(['status' => 200, 'data' => $data]);
    }

    /**
     * @api {post} /index/getArticleList 19、 获取文章列表
     * @apiGroup 首页
     * @apiVersion 1.0.0
     * @apiDescription  获取文章列表
     * @apiParam (输入参数：) {number}      class_id  1 家庭教育, 2 学习方法, 3 教学资讯, 4 教学分享, 5 案例分享
     */
    public function getArticleList()
    {
        $class_id = $this->request->param('class_id', '', 'intval');

        if (! $class_id) {
            return json(['status' => 404, 'msg' => '参数不完整']);
        }

        $list = db('content')->where('class_id', $class_id)->select()->toArray();

        foreach ($list as $k => $v) {
            $list[$k]['detail']      = format_html($list[$k]['detail']);
            $list[$k]['create_time'] = date('Y-m-d H:i:s', $list[$k]['create_time']);
        }

        return json(['status' => 200, 'data' => $list]);
    }

    /**
     * @api {post} /index/getDownloadList 20、 获取下载列表
     * @apiGroup 首页
     * @apiVersion 1.0.0
     * @apiDescription  获取下载列表
     * @apiParam (输入参数：) {number}      user_type  学生|1|primary,老师|2|success
     * @apiParam (输入参数：) {number}      type  新 试卷下载|1|primary,教案下载|2|success
     * @apiParam (输入参数：) {number}      limit 数量
     * @apiParam (输入参数：) {number}      page 页数
     * @apiParam (输入参数：) {number}      keyword 关键词
     */
    public function getDownloadList()
    {
        $limit     = $this->request->param('limit', '50', 'intval');
        $page      = $this->request->param('page', 1, 'intval');
        $user_type = $this->request->param('user_type', '', 'intval');
        $type      = $this->request->param('type', '', 'intval');
        $keyword   = $this->request->param('keyword', '', '');

        if (! $type) {
            return json(['status' => 404, 'msg' => '参数不完整']);
        }

        $where[] = ['status', '=', 1];
        if ($type == 1) {

            if ($user_type == 1) {
                $where[] = ['type', '=', 1];
            } else {
                $where[] = ['type', 'in', [1, 2]];
            }

        } else {
            $where[] = ['type', 'in', [3, 4]];
        }

        if ($keyword) {
            $where[] = ['name', 'like', "%$keyword%"];
        }

        $list = db('file_download')->where($where)->limit(($page - 1) * $limit, $limit)->order('zsort asc,top_time desc,file_download_id desc')->select()->toArray();

        return json(['status' => 200, 'data' => $list]);
    }

    /**
     * @api {post} /index/getHotFaqList 21、 获取常见问题热搜词
     * @apiGroup 首页
     * @apiVersion 1.0.0
     * @apiDescription  获取常见问题热搜词
     */
    public function getHotFaqList()
    {
        $where[] = ['is_hot', '=', 1];
        $list    = db('faq')->where($where)->select()->toArray();

        foreach ($list as $k => $v) {

            $list[$k]['content'] = format_html($list[$k]['content']);
        }

        return json(['status' => 200, 'data' => $list]);
    }

    /**
     * @api {post} /index/getFaqList 22、 获取常见问题列表
     * @apiGroup 首页
     * @apiVersion 1.0.0
     * @apiDescription  获取下载列表
     * @apiParam (输入参数：) {number}      faq_id  热搜问题 id
     * @apiParam (输入参数：) {string}      keywords  关键词
     */
    public function getFaqList()
    {
        $faq_id   = $this->request->param('faq_id', '', 'intval');
        $keywords = $this->request->param('keywords', '', 'intval');

        if ($faq_id) {
            $where[] = ['faq_id', '=', $faq_id];
        }

        if ($keywords) {
            $where[] = ['a.title', 'like', "%$keywords%"];
        }

        $list = db('faq')->alias('a')
            ->field('a.*')
            ->where($where)->select()->toArray();

        foreach ($list as $k => $v) {

            $list[$k]['content'] = format_html($list[$k]['content']);
        }

        return json(['status' => 200, 'data' => $list]);
    }

    /**
     * @api {post} /index/getGzhCode 23、 获取公众号/客服联系电话
     * @apiGroup 首页
     * @apiVersion 1.0.0
     * @apiDescription  获取公众号
     */
    public function getGzhCode()
    {
        $gzh_code    = config("config.gzh_code");
        $service_tel = config("config.service_tel");

        $data['gzh_code']    = $gzh_code;
        $data['service_tel'] = $service_tel;
        $data['xcx_title']   = config("config.site_title");
        return json(['status' => 200, 'data' => $data]);
    }

    /**
     * @api {post} /index/collectUserInfo 24、 收集用户信息
     * @apiGroup 首页
     * @apiVersion 1.0.0
     * @apiDescription  收集用户信息
     * @apiParam (输入参数：) {string}      name  姓名
     * @apiParam (输入参数：) {string}      mobile  电弧
     * @apiParam (输入参数：) {number}      category_id  类别id
     * @apiParam (输入参数：) {number}      grade_id  年级id
     * @apiParam (输入参数：) {number}      subject_id  科目id
     */
    public function collectUserInfo()
    {
        $name        = $this->request->param('name', '', '');
        $mobile      = $this->request->param('mobile', '', '');
        $category_id = $this->request->param('category_id', '', 'intval');
        $grade_id    = $this->request->param('grade_id', '', 'intval');
        $subject_id  = $this->request->param('subject_id', '', 'intval');

        if (! $name || ! $mobile || ! $category_id || ! $grade_id || ! $subject_id) {
            return json(['status' => 404, 'msg' => '参数不完整']);
        }

        $subject_info = db('subject')->where('subject_id', $subject_id)->find();

        $ins['name']         = $name;
        $ins['mobile']       = $mobile;
        $ins['category_id']  = $category_id;
        $ins['grade_id']     = $grade_id;
        $ins['subject_id']   = $subject_id;
        $ins['subject_name'] = $subject_info['name'];
        $ins['create_time']  = time();

        db('user_info')->insertGetId($ins);

        return json(['status' => 200, 'msg' => '提交成功']);
    }

    /**
     * @api {post} /index/getLiveList 25、 获取直播间列表
     * @apiGroup 首页
     * @apiVersion 1.0.0
     * @apiDescription  获取直播间列表
     */
    public function getLiveList()
    {
        $data['start'] = 0;
        $data['limit'] = 20;

        $token = \utils\wechart\UserService::getAccessToken();

        $url = 'https://api.weixin.qq.com/wxa/business/getliveinfo?access_token=' . $token;

        $res     = httpRequest($url, json_encode($data));
        $res_arr = json_decode($res, true);

        if ($res_arr['errcode'] == 0) {
            return json(['status' => 200, 'data' => $res_arr['room_info']]);
        } else {
            return json(['status' => 404, 'msg' => $res_arr['errmsg']]);
        }

    }

    /**
     * @api {post} /index/getFieldStatus 26、 获取字段状态
     * @apiGroup 首页
     * @apiVersion 1.0.0
     * @apiDescription  获取字段状态  id_card_required 教师身份证是否必传/  student_card_required 学生证/毕业证是否必传/  itic_required 教师资格证是否必传  是|1|primary,否|0|success
     */
    public function getFieldStatus()
    {
        $id_card_required      = config("config.id_card_required");
        $student_card_required = config("config.student_card_required");
        $itic_required         = config("config.itic_required");

        $data['id_card_required']      = $id_card_required;
        $data['student_card_required'] = $student_card_required;
        $data['itic_required']         = $itic_required;
        return json(['status' => 200, 'data' => $data]);
    }

    /**
     * @api {post} /index/getNoticeList 27、 获取通告列表
     * @apiGroup 首页
     * @apiVersion 1.0.0
     * @apiDescription  获取通告列表
     */
    public function getNoticeList()
    {
        $list = db('notice')->select()->toArray();

        return json(['status' => 200, 'data' => $list]);
    }

    /**
     * @api {post} /index/getSubjectNames 28、 获取所有科目名称
     * @apiGroup 首页
     * @apiVersion 1.0.0
     * @apiDescription  获取所有科目名称
     */
    public function getSubjectNames()
    {
        $list = db('subject')->field('DISTINCT name')->select()->toArray();

        return json(['status' => 200, 'data' => $list]);
    }

    public function testSend()
    {

        sendTeacherToStu(1);
    }

    /**
     * @api {get} /index/getMiniConfig 29、 获取小程序配置
     * @apiGroup 首页
     * @apiVersion 1.0.0
     * @apiDescription  获取小程序配置
     */
    public function getMiniConfig(){
        $teacher_register_tip = config("config.teacher_register_tip");
        if(!$teacher_register_tip){
            $teacher_register_tip = '/static/images/xuzhi.png';
        }
        $data['teacher_register_tip'] = $teacher_register_tip;
        return json(['status' => 200, 'data' => $data]);
    }
}
