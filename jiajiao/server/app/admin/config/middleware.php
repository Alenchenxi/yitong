<?php

return [
	'alias' => [
        'SetTable' => app\admin\controller\Sys\middleware\SetTable::class,
		'UpTable'  => app\admin\controller\Sys\middleware\UpTable::class,
		'SetField'  => app\admin\controller\Sys\middleware\SetField::class,
		'UpField'  => app\admin\controller\Sys\middleware\UpField::class,
		'DeleteField'  => app\admin\controller\Sys\middleware\DeleteField::class,
		'DeleteMenu'  => app\admin\controller\Sys\middleware\DeleteMenu::class,
		'DeleteApplication'  => app\admin\controller\Sys\middleware\DeleteApplication::class,
    ],
];
