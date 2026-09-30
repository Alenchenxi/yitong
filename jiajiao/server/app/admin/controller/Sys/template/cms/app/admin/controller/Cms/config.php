<?php

//Cms菜单配置

return [
	[
		'title' => 'CMS管理',
		'icon' => 'fa fa-clone',
		'url' => 'admin/Cms',
		'access_url' => 'admin/Cms',
		'sub' =>[
			[
                'title' => '栏目管理',
                'icon' => 'fa fa-clone',
                'url' => url('admin/Cms.Catagory/index'),
				'access_url' => 'admin/Cms.Catagory',
            ],
            [
                'title' => '文章管理',
                'icon' => 'fa fa-clone',
                'url' => url('admin/Cms.Content/index'),
				'access_url' => 'admin/Cms.Content',
            ],
			[
                'title' => '碎片管理',
                'icon' => 'fa fa-clone',
                'url' => url('admin/Cms.Frament/index'),
				'access_url' => 'admin/Cms.Frament',
            ],
			[
                'title' => '推荐位管理',
                'icon' => 'fa fa-clone',
                'url' => url('admin/Cms.Position/index'),
				'access_url' => 'admin/Cms.Position',
            ],
			[
                'title' => '静态化生成',
                'icon' => 'fa fa-clone',
                'url' => url('admin/Cms.DoHtml/index'),
				'access_url' => 'admin/Cms.DoHtml',
            ],
		],
	],
];